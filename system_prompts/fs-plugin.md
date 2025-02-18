Adds a new `fs` plugin to allow interfacing with the `node:fs` module as a data source and data. 

**Status:** Experimental. Not for production use. There are security risks to access when exposing file system access.

## Plugin setup

```ts
// dataprompt.config.js
import { fsPlugin } from 'dataprompt/plugins/fs';

export default {
  plugins: [
    fsPlugin({ sandboxPath: '/path/to/my/sandbox' })
  ];
}
```

## Prompt File

```hbs
---
model: googleai/gemini-2.0-flash-exp
data.prompt:
  sources:
    fs:
      # located in sandbox (default is ./tmp/dataprompt-sandbox)
      message: story.txt 
  result:
    fs:
      append:
        - [story.txt, output]
      overwrite:
        path: full_copy.txt
        format: json
        source: output
output:
  schema: Message
---

Tell me something about this message below. What should we do next? What is your recommendation? Speak like William Shakespeare.
```  

### Data Source
The `fs` plugin allows you to read file contents as data sources for your prompts.

  
```yaml
data.prompt
  sources:
    fs:
      <source_name>: <path> | <config_object>  
```
  
*   `<source_name>`:  A unique name you'll use to refer to this data source in your prompt template (e.g., `message_file`).
*   `<path>`: (String, required if using the string shorthand) The path to the file, *relative to the sandbox directory*.  See \"Security\" below.
*   `<config_object>`: Specify, `format: 'text' | 'json' | 'buffer'`, `path: string`, `source: any`.
  
  
## Accessing Data in Templates:
  
The data read from the file is available in your prompt template under the `<source_name>` you provided.

*   **Text Files:** `{{<source_name>}}` (e.g., `{{message_file}}`)
*   **JSON Files:**
    *   If the JSON is an object: `{{<source_name>.<property>}}` (e.g., `{{my_json.user.name}}`)  
    *   If the JSON is an array: `{{#each <source_name>.items}} ... {{/each}}`
* **Binary Files:** Access the buffer with `{{<source_name>}}` (e.g., `{{my_image}}`). You can encode to base64, for example: `{{my_image.toString 'base64'}}`

## Data Action

The `fs` plugin allows you to write data (typically the prompt's output) to files.

```yaml
result:
  fs:
    <operation_type>: <config> | <config_array>
```
  
*   `<operation_type>`:  One of `overwrite`, `append`, `create`, or `create-or-overwrite`.
*   `<config>`:  *Either* a concise configuration (array) *or* a verbose configuration (object).  You can also provide an *array* of configurations to perform multiple write operations of the same type.
  
*   **Configuration Formats:**

**Concise Format (Array):** `[<path>, <source>]`
* `<path>`: The file path (relative to the sandbox).
*   `<source>`: The name of the data source to write (e.g., `'output'`).
*   *Defaults:*  `format` defaults to `'text'`, and `encoding` defaults to `'utf8'`.

**Verbose Format (Object):**

`path`:  The file path (relative to the sandbox).
*   `encoding`: The character encoding to use (e.g., 'utf8', 'ascii'). Defaults to 'utf8' for text/json, 'buffer' for binary.
*   `format`:
*   `'text'`:  Writes the data as a plain string.  The data source *must* be a string.
*   `'json'`:  Writes the data as a JSON string (pretty-printed).
*   `'binary'`: Writes the data as raw binary. The data source *must* be a `Buffer`.
* If format is not provided, it will be inferred from data type.
* `source`: Refers to the prompt sources to extract the content, this can also be a deep object like: `source.data.items`.

## Operation Types (`mode`):
*   `overwrite`:  Overwrites the file if it exists; creates it if it doesn't.
*   `append`: Appends data to the end of the file; creates it if it doesn't exist.
*   `create`: Creates a *new* file.  *Fails* if the file already exists.
*   `create-or-overwrite`: Creates a new file if it doesn't exist; overwrites the existing file if it does.

## Security Considerations
Always consider the risks of exposing file system access over a network interface like a server API endpoint. This is not intended for production code and is currently an experimental plugin for read and write files from generations. All file operations are restricted to a sandbox directory. By default, this is a temporary directory created by the plugin (typically something like `/tmp/dataprompt-sandbox` on Linux/macOS). You can configure this directory using the `sandboxPath` option when initializing the plugin:

```ts
// dataprompt.config.js
import { fsPlugin } from 'dataprompt/plugins/fs';

export default {
  plugins: [
    fsPlugin({ sandboxPath: '/path/to/my/sandbox' })
  ];
}
```

Attempts to access files outside the sandbox directory will result in an error. This prevents path traversal vulnerabilities. The plugin only uses relative paths within the prompt YAML, and these paths are resolved relative to the sandbox root.
