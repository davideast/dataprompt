import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ConfigManager } from '..//src/core/config.manager.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('ConfigManager with a config file', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = path.resolve(__dirname, 'temp_with_config');
    await fs.mkdir(tempDir, { recursive: true });

    // THIS IS THE KEY FIX: Add a package.json to the temp directory to properly
    // define it as the root for the test, preventing findUp from traversing higher.
    await fs.writeFile(path.join(tempDir, 'package.json'), '{}');

    const dpConfigContent = `
      export default {
        promptsDir: 'custom_prompts',
        secrets: {
          MY_CUSTOM_SECRET: 'secret_value'
        },
      };
    `;
    await fs.writeFile(path.join(tempDir, 'dataprompt.config.js'), dpConfigContent);
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should correctly load settings and merge secrets', async () => {
    // ARRANGE: Set env vars, which will be merged with file secrets.
    process.env.GOOGLEAI_API_KEY = 'test-key-from-env';
    process.env.GOOGLE_APPLICATION_CREDENTIALS = 'creds-from-env';

    const configManager = new ConfigManager({ projectRoot: tempDir });
    
    // ACT
    const config = await configManager.load();

    // ASSERT: Values from the file take precedence or are merged correctly.
    expect(config.promptsDir).toBe(path.resolve(tempDir, 'custom_prompts'));
    expect(config.secrets.MY_CUSTOM_SECRET).toBe('secret_value');
    expect(config.secrets.GOOGLEAI_API_KEY).toBe('test-key-from-env'); // from default
    
    // CLEANUP
    delete process.env.GOOGLEAI_API_KEY;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  });
});

describe('ConfigManager without a config file', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = path.resolve(__dirname, 'temp_without_config');
    await fs.mkdir(tempDir, { recursive: true });
    await fs.writeFile(path.join(tempDir, 'package.json'), '{}');
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should return a default configuration using only environment variables', async () => {
    // ARRANGE
    process.env.GOOGLEAI_API_KEY = 'test-key-for-validation';
    process.env.GOOGLE_APPLICATION_CREDENTIALS = './fake-creds.json';
    
    const configManager = new ConfigManager({ projectRoot: tempDir });
    
    // ACT
    const config = await configManager.load();

    // ASSERT: The configuration should fall back to the defaults from process.env.
    expect(config.secrets.GOOGLEAI_API_KEY).toBe('test-key-for-validation');
    expect(config.secrets.GOOGLE_APPLICATION_CREDENTIALS).toBe('./fake-creds.json');
    expect(config.promptsDir).toBe(path.resolve(tempDir, 'prompts'));

    // CLEANUP
    delete process.env.GOOGLEAI_API_KEY;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  });
});
