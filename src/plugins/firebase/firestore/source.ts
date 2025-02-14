import { RequestContext } from '../../../core/interfaces.js';
import { Firestore } from 'firebase-admin/firestore';
import { 
  FirestoreSourceConfig, 
  FirestoreDocumentResult, 
  FirestoreCollectionResult 
} from './types.js'

const DEFAULT_COLLECTION_LIMIT = 20;

export type FirestoreFetchDataParams = {
  db: Firestore;
  request: RequestContext;
  config: FirestoreSourceConfig;
}

export async function fetchData(
  params: FirestoreFetchDataParams
): Promise<{ [key: string]: any } | FirestoreCollectionResult> {  
  const { db, config } = params;
  // Normalize config to handle both string and object formats
  const path = typeof config === 'string' ? config : config.path;
  const limit = typeof config === 'object' && 'limit' in config 
    ? config.limit ?? DEFAULT_COLLECTION_LIMIT 
    : DEFAULT_COLLECTION_LIMIT;

  // Remove leading/trailing slashes and split path
  const normalizedPath = path.replace(/^\/+|\/+$/g, '');
  
  if (!normalizedPath) {
    throw new Error('Firestore path cannot be empty');
  }

  const segments = normalizedPath.split('/');
  const isCollection = segments.length % 2 === 1;
  try {
    if (isCollection) {
      const collection = db.collection(normalizedPath);
      const snapshot = await collection.limit(limit).get();
      
      const result: FirestoreCollectionResult = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      return result;
    } else {
      const doc = db.doc(normalizedPath);
      const snapshot = await doc.get();
      
      if (!snapshot.exists) {
        return {};
      }
      
      return snapshot.data() as FirestoreDocumentResult;
    }
  } catch (error) {
    throw new Error(
      `Firestore operation failed for path "${normalizedPath}": ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
