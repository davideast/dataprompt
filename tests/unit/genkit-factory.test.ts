import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDefaultGenkit } from '../../src/core/genkit-factory.js';
import { Genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

// Mock dependencies
vi.mock('genkit', () => {
  return {
    Genkit: vi.fn().mockImplementation(() => ({
      defineHelper: vi.fn(),
    })),
  };
});

vi.mock('@genkit-ai/googleai', () => ({
  googleAI: vi.fn().mockReturnValue('mock-google-ai-plugin'),
}));

vi.mock('../../src/utils/helpers/date-format.js', () => ({
  dateFormat: vi.fn(),
}));

describe('GenkitFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create Genkit with Google AI plugin when API key is present', () => {
    const mockConfig: any = {
      secrets: { GOOGLEAI_API_KEY: 'test-key' },
      plugins: [],
      genkitPlugins: [],
    };

    createDefaultGenkit(mockConfig);

    expect(googleAI).toHaveBeenCalledWith({ apiKey: 'test-key' });
    expect(Genkit).toHaveBeenCalledWith(expect.objectContaining({
      plugins: expect.arrayContaining(['mock-google-ai-plugin']),
    }));
  });

  it('should throw error if no plugins and no API key', () => {
    const mockConfig: any = {
      secrets: {},
      plugins: [],
      genkitPlugins: [],
    };

    expect(() => createDefaultGenkit(mockConfig)).toThrow('FATAL: No Genkit plugins configured and GOOGLEAI_API_KEY/GEMINI_API_KEY not found.');
  });

  it('should include user provided genkit plugins', () => {
    const mockConfig: any = {
      secrets: {},
      plugins: [],
      genkitPlugins: ['user-plugin'],
    };

    createDefaultGenkit(mockConfig);

    expect(Genkit).toHaveBeenCalledWith(expect.objectContaining({
      plugins: expect.arrayContaining(['user-plugin']),
    }));
  });
});
