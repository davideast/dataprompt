import { Firestore } from 'firebase-admin/firestore';
import { FirestoreWriteOperation, FirestoreBatchConfig } from './types.js'
import { RequestContext } from '../../core/interfaces.js';

type WriteOperation = 'set' | 'merge' | 'update' | 'push' | 'pushMerge';
type OperationType = WriteOperation | 'delete';
type Operation = {
  type: OperationType;
  // Deletes don't need data
  dataSourceKey?: string;
  path: string;
}

export type FirestoreExecuteParams = {
  db: Firestore;
  request: RequestContext;
  config: FirestoreBatchConfig;
  promptSources: Record<string, any>;
}

const WRITE_OPS: WriteOperation[] = ['set', 'merge', 'update', 'push', 'pushMerge']

export async function execute(params: FirestoreExecuteParams): Promise<void> {
  const { db, config, promptSources } = params;
  const batch = db.batch();
  const operations = flattenOperations(config);

  for (const op of operations) {
    let ref: FirebaseFirestore.DocumentReference;
    if (op.type === 'push' || op.type === 'pushMerge') {
      ref = db.collection(op.path).doc();
    } else {
      ref = db.doc(op.path);
    }

    switch (op.type) {
      case 'set':
        batch.set(ref, resolvePromptSource(op.dataSourceKey!, promptSources));
        break;

      case 'merge':
      case 'pushMerge':
        batch.set(
          ref, 
          resolvePromptSource(op.dataSourceKey!, promptSources), 
          { merge: true }
        );
        break;

      case 'update':
        batch.update(ref, resolvePromptSource(op.dataSourceKey!, promptSources));
        break;

      case 'delete':
        batch.delete(ref);
        break;

      case 'push':
        batch.set(ref, resolvePromptSource(op.dataSourceKey!, promptSources));
        break;
    }
  }

  await batch.commit();
}

function resolvePromptSource(
  source: string, 
  promptResult: Record<string, any>
): any {
  const data = source === 'output' ? promptResult.output : promptResult[source];
  if (data === undefined) {
    throw new Error(`Data source "${source}" not found in prompt result`);
  }
  
  return data;
}

function createWriteOperations(
  operations: FirestoreWriteOperation[] = [], 
  type: Operation['type']
): Operation[] {
  return operations.map(operation => {
    const [documentPath, dataSourceKey] = operation;
    return {
      path: documentPath,
      type,
      dataSourceKey,
    };
  });
}

function flattenOperations(config: FirestoreBatchConfig): Operation[] {
  const writeOps = WRITE_OPS.map(writeOp => {
    return createWriteOperations(config[writeOp], writeOp)
  }).flat()

  const deleteOperations = config.delete
    ? config.delete.map(documentPath => ({
        type: 'delete' as const,
        path: documentPath
      }))
    : [];

  return [
    ...writeOps,
    ...deleteOperations
  ];
}
