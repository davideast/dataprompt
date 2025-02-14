export type FirestoreDocumentConfig = 
  | string  // Simple path like "/sharks/great-white"
  | { 
      path: string;  // Object path like { path: "/sharks/great-white" }
    };

export type FirestoreCollectionConfig = 
  | string  // Simple path like "/sharks" 
  | {
      path: string;
      limit?: number; 
    };

export type FirestoreSourceConfig = FirestoreDocumentConfig | FirestoreCollectionConfig;

export interface FirestoreDocumentResult {
  [key: string]: any;  // This is document data
}

export type FirestoreCollectionResult = Array<{
  id: string;
  [key: string]: any; // Also document data
}>;

export type FirestoreWriteOperation = [string, string]; // [path, dataSource]
export type FirestoreDeletePath = string;

export interface FirestoreBatchConfig {
  set?: FirestoreWriteOperation[];
  merge?: FirestoreWriteOperation[];
  update?: FirestoreWriteOperation[];
  delete?: FirestoreDeletePath[];
  // Push new doc(auto-generated-id)
  push?: [string, string][];
  pushMerge?: [string, string][];
}
