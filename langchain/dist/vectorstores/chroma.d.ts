import type { ChromaClient as ChromaClientT, Collection } from "chromadb";
import { Embeddings } from "../embeddings/base.js";
import { VectorStore } from "./base.js";
import { Document } from "../document.js";
export type ChromaLibArgs = {
    url?: string;
    numDimensions?: number;
    collectionName?: string;
    filter?: object;
} | {
    index?: ChromaClientT;
    numDimensions?: number;
    collectionName?: string;
    filter?: object;
};
type IEmbedResponse = {
    ids: string[];
    embeddings: number[][];
    metadatas: object[];
    documents: Document<any>[];
} | void | undefined;
export declare class Chroma extends VectorStore {
    FilterType: object;
    index?: ChromaClientT;
    collection?: Collection;
    collectionName: string;
    numDimensions?: number;
    url: string;
    filter?: object;
    constructor(embeddings: Embeddings, args: ChromaLibArgs);
    addDocuments(documents: Document[]): Promise<void>;
    ensureCollection(): Promise<Collection>;
    addVectors(vectors: number[][], documents: Document[]): Promise<any | IEmbedResponse>;
    similaritySearchVectorWithScore(query: number[], k: number, filter?: this["FilterType"]): Promise<[Document<Record<string, any>>, number][]>;
    static fromTexts(texts: string[], metadatas: object[] | object, embeddings: Embeddings, dbConfig: {
        collectionName?: string;
        url?: string;
    }): Promise<Chroma>;
    static fromDocuments(docs: Document[], embeddings: Embeddings, dbConfig: {
        collectionName?: string;
        url?: string;
    }): Promise<Chroma>;
    static fromDocumentsVerbose(docs: Document[], embeddings: Embeddings, dbConfig: {
        collectionName?: string;
        url?: string;
    }): Promise<{
        instance: Chroma;
        embedResults: IEmbedResponse;
    }>;
    static fromExistingCollection(embeddings: Embeddings, dbConfig: {
        collectionName: string;
        url?: string;
    }): Promise<Chroma>;
    static imports(): Promise<{
        ChromaClient: typeof ChromaClientT;
    }>;
}
export {};
