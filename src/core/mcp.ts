import { Flow } from "@genkit-ai/flow";
import { PluginManager } from "./plugin.manager.js";

/**
 * Defines the structure for a function within an MCP Tool or Resource.
 * It's an async function that accepts a JSON-like object of parameters.
 */
export type McpFunction = (params: Record<string, any>) => Promise<any>;

/**
 * Defines an MCP Tool, which is a collection of named functions.
 * e.g., { get: (params) => { ... }, list: (params) => { ... } }
 */
export type McpTool = Record<string, McpFunction>;

/**
 * Defines an MCP Resource, which is structurally similar to a Tool.
 * The distinction is semantic: Resources are for data access, Tools for actions.
 */
export type McpResource = McpTool;

/**
 * Defines an MCP Prompt, which is a reference to another Genkit flow.
 * This allows chaining prompts together.
 */
export type McpPrompt = Flow<any, any, any>;

/**
 * The McpRegistry is the central point for registering and managing
 * all custom MCP tools, resources, and prompts within the application.
 * It dynamically creates and registers the necessary providers with the
 * PluginManager, making them available to the prompt engine.
 */
export class McpRegistry {
  readonly tools = new Map<string, McpTool>();
  readonly resources = new Map<string, McpResource>();
  readonly prompts = new Map<string, McpPrompt>();

  // The registry needs access to the PluginManager to dynamically register providers.
  constructor(private pluginManager: PluginManager) {}

  /**
   * Registers a new MCP Tool. This makes the tool available as a top-level
   * provider in prompt files. For example, registering a tool named 'weather'
   * allows you to use `weather:` in the `sources` or `result` blocks.
   * @param name The name of the tool (e.g., 'weather').
   * @param tool The tool implementation.
   */
  registerTool(name: string, tool: McpTool) {
    if (this.tools.has(name)) {
      console.warn(`MCP Warning: Tool '${name}' is already registered. Overwriting.`);
    }
    this.tools.set(name, tool);
    // Dynamically create and register a provider for this tool.
    this.pluginManager.registerMcpProvider(name, tool);
  }

  /**
   * Registers a new MCP Resource. This makes the resource available as a
   * top-level provider in prompt files.
   * @param name The name of the resource (e.g., 'user').
   * @param resource The resource implementation.
   */
  registerResource(name: string, resource: McpResource) {
    if (this.resources.has(name)) {
      console.warn(`MCP Warning: Resource '${name}' is already registered. Overwriting.`);
    }
    this.resources.set(name, resource);
    // Dynamically create and register a provider for this resource.
    this.pluginManager.registerMcpProvider(name, resource);
  }

  /**
   * Registers a new MCP Prompt. This allows one prompt to be called from another.
   * @param name The name of the prompt (e.g., 'summarizer').
   * @param prompt The prompt implementation (a Genkit flow).
   */
  registerPrompt(name: string, prompt: McpPrompt) {
    if (this.prompts.has(name)) {
      console.warn(`MCP Warning: Prompt '${name}' is already registered. Overwriting.`);
    }
    this.prompts.set(name, prompt);
    // Dynamically create and register a provider for this prompt.
    this.pluginManager.registerMcpProvider(name, prompt);
  }
}