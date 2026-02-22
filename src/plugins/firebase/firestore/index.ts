import { z } from 'genkit';
import { DataActionProvider, DataSourceProvider, DatapromptPlugin, FetchDataParams, ExecuteParams } from '../../../core/interfaces.js';
import { getFirebaseApp } from '../app.js'
import { getFirestore } from 'firebase-admin/firestore';
import { fetchData } from './source.js'
import { execute } from './actions.js'
import { FirebasePluginConfig } from '../types.js';
import { FirestoreSourceConfig, FirestoreBatchConfig } from './types.js';

const FirestorePluginSecrets = z.object({
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional()
});

export function firestorePlugin(
  config?: FirebasePluginConfig
): DatapromptPlugin<typeof FirestorePluginSecrets> {
  const name = 'firestore'
  const app = getFirebaseApp(config)
  const db = getFirestore(app)
  const secrets = config?.secrets ?? {}

  return {
    name,
    createDataSource(): DataSourceProvider<unknown> {
      return {
        name,
        fetchData(params: FetchDataParams<unknown>) {
          const config = params.config as FirestoreSourceConfig;
          return fetchData({ db, ...params, config })
        }
      }
    },
    createDataAction(): DataActionProvider<unknown> {
      return {
        name,
        execute(params: ExecuteParams<unknown>): Promise<void> {
          const config = params.config as FirestoreBatchConfig;
          return execute({ db, ...params, config })
        }
      }
    },
    provideSecrets() {
      return {
        secrets,
        schema: FirestorePluginSecrets,
      }
    }
  }
}
