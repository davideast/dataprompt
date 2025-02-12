import type { App, Credential } from "firebase-admin/app";

export type FirebasePluginConfig = {
  credential?: Credential;
  app?: App;
}
