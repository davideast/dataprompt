import { z } from 'genkit';
import { DataActionProvider, DataSourceProvider, DatapromptPlugin } from '../../../plugins/interfaces.js';
import { createPlugin } from '../../../plugins/index.js'
import { getFirebaseApp } from '../app.js'
import { getFirestore } from 'firebase-admin/firestore';
import { fetchData } from './source.js'
import { execute } from './actions.js'
import { FirebasePluginConfig } from '../types.js';

const FirestorePluginSecrets = z.object({
  GOOGLE_APPLICATION_CREDENTIALS: z.string().min(1)
});

export const firestorePlugin = createPlugin<
  typeof FirestorePluginSecrets, FirebasePluginConfig
>({
  name: 'firestore',
  schema: z.object({
    GOOGLE_APPLICATION_CREDENTIALS: z.string().min(1)
  }),
  source: (config?: FirebasePluginConfig) => {
    const app = getFirebaseApp(config)
    const db = getFirestore(app)
    return {
      name: 'firestore',
      fetchData(params) {
        return fetchData({ db, ...params })
      }
    }
  },
  action: (config?: FirebasePluginConfig) => {
    const app = getFirebaseApp(config)
    const db = getFirestore(app)
    return {
      name: 'firestore',
      execute(params): Promise<void> {
        return execute({ db, ...params })
      }
    }
  }
})

function _firestorePlugin(
  config?: FirebasePluginConfig
): DatapromptPlugin<typeof FirestorePluginSecrets> {
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
    provideSecrets() {
      return {
        secrets,
        schema: FirestorePluginSecrets,
      }
    }
  }
}
