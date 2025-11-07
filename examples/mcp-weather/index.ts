import { createPromptServer, McpTool, McpResource } from '../../src/index.js';

// Define a custom tool for getting weather data
const weatherTool: McpTool = {
  // The 'get' function is what gets called from the prompt file
  async get(params: { location: string }) {
    console.log(`Fetching weather for ${params.location}...`);
    // In a real implementation, this would call a weather API
    return {
      city: params.location,
      temperature: 72,
      forecast: 'Sunny',
    };
  }
};

// Define a custom resource for loading user data
const userResource: McpResource = {
  async get(params: { id: string }) {
    console.log(`Fetching user ${params.id}...`);
    // In a real implementation, this would fetch from a database
    return {
      id: params.id,
      name: 'Jane Doe',
      email: 'jane.doe@example.com',
    };
  }
};

async function start() {
  // Create the server and get access to the store
  const { server, store } = await createPromptServer({
    // The configuration options must be passed inside a `config` object.
    config: {
      // Set the root directory to the current working directory.
      rootDir: process.cwd(),
      // Point to the prompts directory for this example
      promptsDir: './examples/mcp-weather/prompts'
    }
  });

  // Register the tool and resource. They are now first-class providers.
  store.mcp.registerTool('weather', weatherTool);
  store.mcp.registerResource('user', userResource);

  console.log("Custom MCP providers 'weather' and 'user' are now registered.");

  // Start the server
  const port = 3000;
  server.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
    console.log('Try visiting http://localhost:3000/report?location=New%20York');
  });
}

start();