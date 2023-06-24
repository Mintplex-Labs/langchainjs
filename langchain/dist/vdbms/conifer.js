import { v4 } from 'uuid';
export class ConiferVDBMS {
    constructor(coniferArgs) {
        Object.defineProperty(this, "basePath", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "orgId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "workspaceId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "apiKey", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.basePath = coniferArgs?.basePath ?? 'https://api-clbxnueuea-uc.a.run.app/v1';
        this.orgId = coniferArgs?.orgId;
        this.workspaceId = coniferArgs?.workspaceId ?? null;
        this.apiKey = coniferArgs?.apiKey;
        this.validateConfig();
    }
    validateConfig() {
        if (!this.basePath || !this.orgId || !this.apiKey) {
            throw new Error('Invalid configuration for instance of Conifer VDBMS');
        }
        return;
    }
    assembleHeaders(workspaceId) {
        const _workspaceId = workspaceId ?? this.workspaceId;
        return {
            'X-Org-Id': this.orgId,
            'X-Api-Key': this.apiKey,
            ...(_workspaceId ? { 'X-Workspace-Id': _workspaceId } : {})
        };
    }
    baseURI(path = '') {
        return `${this.basePath}${path ? `${path}` : ''}`;
    }
    async fetch({ path, options, requestBody }) {
        const fetchOpts = { ...options };
        if (!!requestBody)
            fetchOpts.body = JSON.stringify(requestBody ?? {});
        return fetch(this.baseURI(path), fetchOpts)
            .then((res) => res.json())
            .catch((e) => {
            console.error(`Conifer`, e.message);
            console.error(e);
            return false;
        });
    }
    async createRootDocument(documentName, workspaceId) {
        if (workspaceId === null)
            throw new Error("Workspace id cannot be null. Documents must belong to a workspace.");
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
            if (!response)
                return false;
            if (response.error) {
                console.error('Conifer::createRootDocument', response.error);
                return;
            }
            return response.document;
        });
    }
    appendDocumentData(rootDocumentId, packet, order) {
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
        });
    }
    concludeDocumentSync(rootDocumentId) {
        return this.fetch({
            path: `/${rootDocumentId}/conclude-workspace-document-sync`,
            options: {
                method: 'GET',
                headers: this.assembleHeaders()
            },
        });
    }
    documentsInOrganization() {
        return this.fetch({
            path: `/documents/all`,
            options: {
                method: 'GET',
                headers: this.assembleHeaders()
            },
        });
    }
    documentsInWorkspace(workspaceId) {
        return this.fetch({
            path: `/documents/workspace`,
            options: {
                method: 'GET',
                headers: this.assembleHeaders(workspaceId)
            },
        });
    }
    documentVectorIds(docId) {
        return this.fetch({
            path: `/documents/${docId}/vector-ids`,
            options: {
                method: 'GET',
                headers: this.assembleHeaders()
            },
        })
            .then((response) => response?.ids ?? []);
    }
    // Sync a split document with the Conifer Database org and workspace
    async addDocuments(vectorData, useWorkspaceId) {
        const documentName = vectorData.metadatas[0].documentTitle ?? v4();
        const rootDocument = await this.createRootDocument(documentName, useWorkspaceId ?? this.workspaceId);
        if (!rootDocument) {
            console.error('Could not create root document - aborting Conifer VDBMS sync.');
            return false;
        }
        const chunkSize = 100;
        const dataPackets = [];
        for (let i = 0; i < vectorData.ids.length; i += chunkSize) {
            const packet = {
                ids: vectorData.ids.slice(i, i + chunkSize),
                vectors: vectorData.embeddings.slice(i, i + chunkSize),
                metadatas: vectorData.metadatas.slice(i, i + chunkSize),
            };
            dataPackets.push(() => this.appendDocumentData(rootDocument.uid, packet, i));
        }
        console.log(`Syncing ${dataPackets.length} document fragments with Conifer.`);
        const queue = dataPackets.map(packet => packet());
        await Promise.all(queue).then(result => {
            console.log({ documentCreationResult: result });
        });
        await this.concludeDocumentSync(rootDocument.uid);
        return;
    }
    async getDocuments(workspaceId) {
        const funcName = workspaceId ? 'documentsInWorkspace' : 'documentsInOrganization';
        const documents = await this[funcName](workspaceId);
        return documents;
    }
    async deleteAllWorkspaceDocuments(pineconeIndex, pineconeNamespace, useWorkspaceId) {
        await pineconeIndex.delete1({ namespace: pineconeNamespace, deleteAll: true });
        await this.fetch({
            path: `/documents/workspace`,
            options: {
                method: 'DELETE',
                headers: this.assembleHeaders(useWorkspaceId ?? this.workspaceId)
            },
        });
    }
    async deleteDocument(pineconeIndex, pineconeNamespace, coniferDocumentId) {
        const vectorIds = await this.documentVectorIds(coniferDocumentId);
        await pineconeIndex.delete1({ namespace: pineconeNamespace, ids: vectorIds });
        await this.fetch({
            path: `/documents/${coniferDocumentId}`,
            options: {
                method: 'DELETE',
                headers: this.assembleHeaders()
            },
        });
    }
}
