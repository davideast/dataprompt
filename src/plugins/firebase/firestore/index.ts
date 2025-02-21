import { z } from 'genkit';
import { DataActionProvider, DataSourceProvider, DatapromptPlugin } from '../../../core/interfaces.js';
import { getFirebaseApp } from '../app.js'
import { getFirestore } from 'firebase-admin/firestore';
import { fetchData } from './source.js'
import { execute } from './actions.js'
import { FirebasePluginConfig } from '../types.js';

export const FirestorePluginConfigSchema = z.object({
  secrets: z.object({
    GOOGLE_APPLICATION_CREDENTIALS: z.string().min(1)
  })
})

export function firestorePlugin(config?: FirebasePluginConfig): DatapromptPlugin<{
  config: FirebasePluginConfig;
  schema: typeof FirestorePluginConfigSchema;
}> {
  const name = 'firestore'
  const app = getFirebaseApp(config)
  const db = getFirestore(app)
  const secrets = config?.secrets ?? {}

  return {
    name,
    createDataSource(): DataSourceProvider {
      return {
        name,
        fetchData(params) {
          return fetchData({ db, ...params })
        }
      }
    },
    createDataAction(): DataActionProvider {
      return {
        name,
        execute(params): Promise<void> {
          return execute({ db, ...params })
        }
      }
    },
    provideConfig() {
      return {
        config: { secrets },
        schema: FirestorePluginConfigSchema
      }
    }
  }
}
