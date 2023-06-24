import { BaseVectorDatabaseManagementSystem } from "./base.js";
import { PineconeLibArgs } from '../vectorstores/pinecone.js';
export interface ConiferVDBMSConfig extends BaseVectorDatabaseManagementSystem {
    basePath: string;
    orgId: string;
    workspaceId?: string;
    apiKey: string;
}
type CreateVectorData = {
    embeddings: number[][];
    metadatas: Array<{
        documentTitle: string;
    }>;
    ids: Array<string>;
};
export declare class ConiferVDBMS {
    private basePath?;
    private orgId;
    private workspaceId;
    private apiKey;
    constructor(coniferArgs: ConiferVDBMSConfig);
    private validateConfig;
    private assembleHeaders;
    private baseURI;
    private fetch;
    private createRootDocument;
    private appendDocumentData;
    private concludeDocumentSync;
    private documentsInOrganization;
    private documentsInWorkspace;
    private documentVectorIds;
    private documentVectorCache;
    addDocuments(vectorData: CreateVectorData, useWorkspaceId?: string): Promise<false | undefined>;
    getDocuments(workspaceId?: string): Promise<any>;
    deleteAllWorkspaceDocuments(pineconeIndex: PineconeLibArgs['pineconeIndex'], pineconeNamespace: string, useWorkspaceId?: string): Promise<void>;
    deleteDocument(pineconeIndex: PineconeLibArgs['pineconeIndex'], pineconeNamespace: string, coniferDocumentId: string): Promise<void>;
    copyDocumentToNamespace(pineconeIndex: PineconeLibArgs['pineconeIndex'], targetPineconeNamespace: string, coniferDocumentId: string, targetWorkspaceId: string): Promise<void>;
}
export {};
