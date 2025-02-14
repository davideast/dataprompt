import { DataActionProvider, DataSourceProvider, DatapromptPlugin } from '../../../core/interfaces.js';
import { getFirebaseApp } from '../app.js'
import { getFirestore } from 'firebase-admin/firestore';
import { fetchData } from './source.js'
import { execute } from './actions.js'
import { FirebasePluginConfig } from '../types.js';

export function firestorePlugin(config?: FirebasePluginConfig): DatapromptPlugin {
  const name = 'firestore'
  const app = getFirebaseApp(config)
  const db = getFirestore(app)

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
    }
  }
}
