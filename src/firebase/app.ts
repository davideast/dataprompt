import { App, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { FirebasePluginConfig } from './types.js';

export function getFirebaseApp(config: FirebasePluginConfig = {}): App {
  if (getApps().length === 1) { return getApp(); }
  return config.credential != null ? 
    initializeApp({ credential: config.credential }) :
    initializeApp();
}
