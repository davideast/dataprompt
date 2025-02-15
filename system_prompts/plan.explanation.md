This revised testing structure focuses on the most critical behaviors of `dataprompt`, prioritizing integration tests and key functionalities.

*   **Integration Tests**: The top-level `integration` directory contains tests that cover the core workflows of the library, specifically:
    *   `dataprompt_server_test.ts`: Tests the `dataprompt` function (the public API) and the server creation process, ensuring that everything works correctly.
    *   `routing_test.ts`: Contains end-to-end tests for routing, including dynamic parameters, different request types, and ensuring that requests are routed to the correct flows.
    *   `plugins_test.ts`: Integration tests for data source and action plugins (fetch, firebase, scheduler), ensuring that they are correctly registered and that data is fetched and actions are executed as expected.
*   **Core Tests**: The `core` directory contains tests for the fundamental building blocks of the library, specifically:
    *   `registry_test.ts`: Tests the plugin registration and retrieval mechanism, ensuring that plugins can be registered and retrieved correctly.
    *   `yaml_extraction_test.ts`: Tests the YAML extraction from `.prompt` files, ensuring that the correct data is extracted from the files. This test is essential for ensuring that the library can correctly parse the `.prompt` files.
*   **Routing Tests**: The `routing` directory contains tests for the routing mechanism, specifically:
    *   `flow_builder_data_test.ts`: Tests different data source configurations and data fetching within the flow-builder, ensuring that data sources are correctly configured and that data is fetched as expected.
    *   `flow_builder_action_test.ts`: Tests the action execution and variable usage within the flow-builder, ensuring that actions are executed as expected and that variables are correctly used.
*   **Utils Tests**: The `utils` directory contains tests for the utility functions, specifically:
    *   `schema_loader_test.ts`: Tests the schema loading and registration mechanism, ensuring that schemas are loaded and registered correctly.
*   **Test Utilities**: The `test_utils.ts` file contains utility functions for setting up tests, mocking dependencies, and performing common assertions. This file is essential for reducing code duplication and ensuring that tests are consistent.

This structure provides a pragmatic approach to testing, focusing on the most critical behaviors of the library and ensuring that changes to the codebase do not break these behaviors.

## File structure

```text
tests/
├── integration
│   ├── dataprompt_server_test.ts  # Integration tests for the core dataprompt function and server creation
│   ├── routing_test.ts             # End-to-end routing tests with dynamic parameters and different request types
│   ├── plugins_test.ts             # Integration tests for data source/action plugins (fetch, firebase, scheduler)
├── core
│   ├── registry_test.ts            # Focused tests for plugin registration and retrieval
│   ├── yaml_extraction_test.ts     # Tests to validate specific YAML extractions from .prompt files
├── routing
│   ├── flow_builder_data_test.ts   # Test different data source configurations and data fetching within flow-builder
│   ├── flow_builder_action_test.ts # Test action execution and variable usage within flow-builder
├── utils
│   ├── schema_loader_test.ts        # Ensure schemas load and register correctly
└── test_utils.ts                # Utility functions for setting up tests, mocking dependencies, etc.
```
