import { v4 } from 'uuid'
import { BaseVectorDatabaseManagementSystem } from "./base.js";
import { PineconeLibArgs } from '../vectorstores/pinecone.js';

export interface ConiferVDBMSConfig extends BaseVectorDatabaseManagementSystem {
  basePath: string;
  orgId: string;
  workspaceId?: string;
  apiKey: string;
}

type ConiferFetch = {
  path: string;
  options: {
    headers: any;
    method: 'GET' | 'POST' | 'DELETE'
  }
  requestBody?: object;
}

type CreateVectorData = {
  embeddings: number[][];
  metadatas: Array<{ documentTitle: string }>;
  ids: Array<string>;
}

type RootDocument = {
  uid: string,
}

type RootDocumentPacket = {
  ids: string[],
  vectors: number[][],
  metadatas: object[],
}

export class ConiferVDBMS {
  private basePath?: string;
  private orgId: string;
  private workspaceId: string | null;
  private apiKey: string;

  constructor(coniferArgs: ConiferVDBMSConfig) {
    this.basePath = coniferArgs?.basePath ?? 'https://api-clbxnueuea-uc.a.run.app/v1'
    this.orgId = coniferArgs?.orgId
    this.workspaceId = coniferArgs?.workspaceId ?? null
    this.apiKey = coniferArgs?.apiKey
    this.validateConfig();
  }

  private validateConfig() {
    if (!this.basePath || !this.orgId || !this.apiKey) {
      throw new Error('Invalid configuration for instance of Conifer VDBMS');
    }
    return;
  }

  private assembleHeaders(workspaceId?: string | null) {
    const _workspaceId = workspaceId ?? this.workspaceId;
    return {
      'X-Org-Id': this.orgId,
      'X-Api-Key': this.apiKey,
      ...(_workspaceId ? { 'X-Workspace-Id': _workspaceId } : {})
    }
  }

  private baseURI(path = '') {
    return `${this.basePath}${path ? `${path}` : ''}`;
  }

  private async fetch({ path, options, requestBody }: ConiferFetch) {
    const fetchOpts: ConiferFetch['options'] & { body?: string } = { ...options };
    if (!!requestBody) fetchOpts.body = JSON.stringify(requestBody ?? {})
    return fetch(this.baseURI(path), fetchOpts)
      .then((res) => res.json())
      .catch((e) => {
        console.error(`Conifer`, e.message);
        console.error(e);
        return false;
      })
  }

  private async createRootDocument(documentName: string, workspaceId: string | null): Promise<any | RootDocument> {
    if (workspaceId === null) throw new Error("Workspace id cannot be null. Documents must belong to a workspace.");
    return this.fetch({
      path: '/create-root-document',
      options: {
        method: 'POST',
        headers: this.assembleHeaders(workspaceId)
      },
      requestBody: {
        documentName,
      }
    })
      .then((response) => {
        if (!response) return false;
        if (response.error) {
          console.error('Conifer::createRootDocument', response.error)
          return;
        }

        return response.document;
      })

  }

  private appendDocumentData(rootDocumentId: string, packet: RootDocumentPacket, order: number) {
    return this.fetch({
      path: '/append-workspace-document-packet',
      options: {
        method: 'POST',
        headers: this.assembleHeaders()
      },
      requestBody: {
        docId: rootDocumentId,
        order,
        packet,
      }
    })
  }

  private concludeDocumentSync(rootDocumentId: string) {
    return this.fetch({
      path: `/${rootDocumentId}/conclude-workspace-document-sync`,
      options: {
        method: 'GET',
        headers: this.assembleHeaders()
      },
    })
  }

  private documentsInOrganization() {
    return this.fetch({
      path: `/documents/all`,
      options: {
        method: 'GET',
        headers: this.assembleHeaders()
      },
    })
  }

  private documentsInWorkspace(workspaceId?: string) {
    return this.fetch({
      path: `/documents/workspace`,
      options: {
        method: 'GET',
        headers: this.assembleHeaders(workspaceId)
      },
    })
  }

  private documentVectorIds(docId: string) {
    return this.fetch({
      path: `/documents/${docId}/vector-ids`,
      options: {
        method: 'GET',
        headers: this.assembleHeaders()
      },
    })
      .then((response) => response?.ids ?? [])
  }

  private documentVectorCache(docId: string) {
    return this.fetch({
      path: `/documents/${docId}/cache`,
      options: {
        method: 'GET',
        headers: this.assembleHeaders()
      },
    })
  }

  // Sync a split document with the Conifer Database org and workspace
  public async addDocuments(vectorData: CreateVectorData, useWorkspaceId?: string) {
    const documentName = vectorData.metadatas[0].documentTitle ?? v4();
    const rootDocument = await this.createRootDocument(documentName, useWorkspaceId ?? this.workspaceId);
    if (!rootDocument) {
      console.error('Could not create root document - aborting Conifer VDBMS sync.');
      return false;
    }

    const chunkSize = 100;
    const dataPackets = []
    for (let i = 0; i < vectorData.ids.length; i += chunkSize) {
      const packet = {
        ids: vectorData.ids.slice(i, i + chunkSize),
        vectors: vectorData.embeddings.slice(i, i + chunkSize),
        metadatas: vectorData.metadatas.slice(i, i + chunkSize),
      }
      dataPackets.push(() => this.appendDocumentData(rootDocument.uid, packet, i))
    }

    console.log(`Syncing ${dataPackets.length} document fragments with Conifer.`);
    const queue = dataPackets.map(packet => packet())
    await Promise.all(queue).then(result => {
      console.log({ documentCreationResult: result });
    });
    await this.concludeDocumentSync(rootDocument.uid);

    return;
  }

  public async getDocuments(workspaceId?: string) {
    const funcName = workspaceId ? 'documentsInWorkspace' : 'documentsInOrganization';
    const documents = await this[funcName](workspaceId);
    return documents;
  }

  public async deleteAllWorkspaceDocuments(pineconeIndex: PineconeLibArgs['pineconeIndex'], pineconeNamespace: string, useWorkspaceId?: string) {
    await pineconeIndex.delete1({ namespace: pineconeNamespace, deleteAll: true });
    await this.fetch({
      path: `/documents/workspace`,
      options: {
        method: 'DELETE',
        headers: this.assembleHeaders(useWorkspaceId ?? this.workspaceId)
      },
    })
  }

  public async deleteDocument(pineconeIndex: PineconeLibArgs['pineconeIndex'], pineconeNamespace: string, coniferDocumentId: string) {
    const vectorIds = await this.documentVectorIds(coniferDocumentId);
    await pineconeIndex.delete1({ namespace: pineconeNamespace, ids: vectorIds });
    await this.fetch({
      path: `/documents/${coniferDocumentId}`,
      options: {
        method: 'DELETE',
        headers: this.assembleHeaders()
      },
    })
  }

  public async copyDocumentToNamespace(pineconeIndex: PineconeLibArgs['pineconeIndex'], targetPineconeNamespace: string, coniferDocumentId: string, targetWorkspaceId: string) {
    const embeddingInformation = await this.documentVectorCache(coniferDocumentId);
    const pineconeVectors = embeddingInformation.vectors.map((values, idx) => {
      const knownId = embeddingInformation.ids[idx];
      const metadata = embeddingInformation.metadatas[idx];
      return {
        id: `${knownId}_cpy_${targetPineconeNamespace}`,
        metadata,
        values,
      };
    });

    const chunkSize = 50;
    for (let i = 0; i < pineconeVectors.length; i += chunkSize) {
      const chunk = pineconeVectors.slice(i, i + chunkSize);
      await pineconeIndex.upsert({
        upsertRequest: {
          vectors: chunk,
          namespace: targetPineconeNamespace,
        },
      });
    }

    const vectorData = {
      ids: pineconeVectors.map((vector) => vector.id),
      metadatas: pineconeVectors.map((vector) => vector.metadata),
      embeddings: pineconeVectors.map((vector) => vector.values),
    }

    await this.addDocuments(vectorData, targetWorkspaceId);
    return;
  }
}