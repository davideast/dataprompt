This configuration file sets up the Vite test runner for your project.

*   `test.include`: Specifies the files that Vitest should consider as test files. In this case, it's set to `['src/tests/integration/dataprompt_server_test.ts']`, meaning only this file will be executed when running tests.
*   `test.globals`: Enables the use of global test APIs like `describe`, `it`, `expect` without needing to import them.
*   `test.environment`: Configures the test environment to be 'node', indicating that tests will run in a Node.js environment.
*   `test.setupFiles`: Allows you to specify files that should be run before each test file is executed.  It's currently empty, meaning no setup scripts are run.
*   `test.coverage`: Configures coverage reports.
*   `resolve.alias`: Configures an alias to resolve imports from `@` to the `src` directory.


## Packages to install
```json
[
  "vite",
  "vitest",
  "@vitest/coverage-v8"
]
```

```bash
npm install -D vite vitest @vitest/coverage-v8
```

## Files to add
```
{
  "added": [
    "vite.config.ts"
  ],
  "modified": [],
  "removed": []
}
```