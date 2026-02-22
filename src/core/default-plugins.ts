import { firestorePlugin } from '../plugins/firebase/public.js';
import { schedulerPlugin } from '../plugins/scheduler/index.js';
import { fetchPlugin } from '../plugins/fetch/index.js';
import { DatapromptPlugin } from './interfaces.js';

export function getDefaultPlugins(): DatapromptPlugin[] {
  return [
    firestorePlugin(),
    fetchPlugin(),
    schedulerPlugin(),
  ];
}

export function resolvePlugins(userPlugins: DatapromptPlugin[] = []): DatapromptPlugin[] {
  const plugins = [...userPlugins];
  if (!plugins.some(p => p.name === 'firestore')) plugins.push(firestorePlugin());
  if (!plugins.some(p => p.name === 'fetch')) plugins.push(fetchPlugin());
  if (!plugins.some(p => p.name === 'schedule')) plugins.push(schedulerPlugin());
  return plugins;
}
