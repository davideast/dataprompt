import { RequestContext } from '../../core/interfaces.js';
import { DataSourceProvider, DatapromptPlugin, FetchDataParams } from '../../core/interfaces.js';

export interface FetchConfig {
  url: string; 
  format?: 'json' | 'text';
}

export function fetchPlugin(): DatapromptPlugin {
  const name = 'fetch'
  return {
    name,
    createDataSource(): DataSourceProvider<unknown> {
      return {
        name,
        fetchData(params: FetchDataParams<unknown>) {
          const config = params.config as string | FetchConfig;
          return fetchData({ ...params, config });
        }
      }
    }
  }
}

export async function fetchData(params: { 
  request: RequestContext, 
  config: string | FetchConfig 
}): Promise<Record<string, any>> {
  const { config } = params;
  // Handle both string and object configs
  const fetchConfig = typeof config === 'string' 
    ? { url: config, format: 'json' as const }
    : { format: 'json' as const, ...config };

  const response = await fetch(fetchConfig.url);
  
  // Return data based on format
  if (fetchConfig.format === 'text') {
    const text = await response.text();
    return { content: text };
  }

  // Default to JSON
  const data = await response.json();
  return Array.isArray(data) ? { items: data } : data;
}
