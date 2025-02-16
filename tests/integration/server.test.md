This code generates integration tests for the `dataprompt` server. Here's a breakdown:

*   **Imports:** Imports necessary modules like `vitest`, `memory-fs`, `express`, and `supertest`.
*   **`getGenkit()` Helper:** A placeholder function that simulates obtaining a Genkit instance.  This needs to be fleshed out in a real implementation.
*   **`testPromptContent`:** A simple prompt content for testing.
*   **`describe` Block:**  Encapsulates all the tests related to Dataprompt Server Integration.
*   **`beforeAll` and `afterAll`:**
    *   `beforeAll`: Creates a temporary directory `tempDir` before all tests run.
    *   `afterAll`: Cleans up the temporary directory `tempDir` after all tests have completed.
*   **`beforeEach` and `afterEach`:**
    *   `beforeEach`: Initializes `MemoryFileSystem` (`memfs`) and ensures that the temporary directory exists within the memory filesystem before each test case.
    *   `afterEach`: Properly closes the server (`server`) and sets it to `null` after each test.
*   **`setupStoreAndServer` Function:** A helper function to create a Dataprompt store and server with specified options and prompt files. It takes the following steps:
    *   Writes prompt files to memory filesystem.
    *   Creates Dataprompt store using `createDatapromptStore` function.
    *   Creates Dataprompt server using `createDatapromptServer` function.
    *   Returns the store and the server.
*   **Test Cases:**
    *   **"should create a dataprompt store with default options"**: Checks if a store is created with default settings, verifying initial state of routes, flows, tasks, and data sources.
    *   **"should create a dataprompt store with different options (prompt directory)"**:  Tests store creation with a custom prompt directory.
    *   **"should register a custom plugin"**: Tests if a custom plugin can be registered.
    *   **"should create a dataprompt server from the store"**: Checks if a server instance is created.
    *   **"should serve a prompt and return a response"**: Creates a basic route, serves a prompt, and checks the HTTP status code (200 OK).
    *   **"should invoke the correct flow with params from the request URL"**: Tests if the correct flow is invoked based on URL parameters.
    *   **"should handle data inputs alongside URL parameters"**: Tests handling of both URL parameters and data inputs sent via a POST request.

Key improvements and explanations:

*   **Memory File System:** Uses `memory-fs` for file operations, avoiding disk I/O and making tests faster and more reliable.
*   **Proper Server Lifecycle:** Includes `beforeEach` and `afterEach` hooks to ensure that the server is properly started and stopped between tests, preventing port conflicts and other issues.
*   **Comprehensive Store Configuration:**  Tests different store configurations, including custom prompt directories and plugin registration.
*   **Route Parameter Testing:** Includes a test case to verify that route parameters are correctly extracted from the request URL and passed to the flow.
*   **Data Input Handling:**  Adds a test case to ensure that data inputs (e.g., JSON data sent in a POST request) are correctly processed.
*   **Test Setup Helper:** Simplifies test setup by using a helper function to create the store and server with different configurations.
*   **Clear Assertions:**  Uses `expect` to make clear assertions about the expected behavior of the code.

## New libraries

```json
[
  "vitest",
  "memory-fs",
  "supertest",
  "@types/supertest"
]
```

```bash
npm install -D vitest memory-fs supertest @types/supertest
```
