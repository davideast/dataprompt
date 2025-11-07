# Analysis
## The code I, Jules, located

```.prompt
---
model: googleai/gemini-2.0-flash
data.prompt:
  sources:
    fetch:
      news: https://api.hnpwa.com/v0/news/1.json
output:
  schema: HNAnalysisSchema
---
Analyse the articles below.

{{json news}}
```

## My analysis

This code block demonstrates a basic `.prompt` file. Here's a breakdown of its components:

*   **Frontmatter:** The section between the `---` delimiters is the frontmatter, written in YAML.
    *   `model`: Specifies the AI model to be used, in this case, `googleai/gemini-2.0-flash`.
    *   `data.prompt`: This is a dataprompt-specific extension.
        *   `sources`:  This section defines data to be fetched and made available to the prompt.
            *   `fetch`:  Uses the built-in `fetch` plugin.
                *   `news`:  This defines a variable named `news`. The value is a URL to a JSON API (`https://api.hnpwa.com/v0/news/1.json`), which suggests that the content of this URL will be fetched and assigned to the `news` variable.
    *   `output`:  This section defines the expected output format.
        *   `schema`:  The output should conform to the `HNAnalysisSchema` Zod schema, which is likely defined in a separate `schema.ts` file.

*   **Prompt Body:** The content below the frontmatter is the prompt that will be sent to the AI model.
    *   `Analyse the articles below.`: This is a direct instruction to the model.
    *   `{{json news}}`: This is a Handlebars expression. The `json` helper likely serializes the `news` variable (which contains the fetched JSON data) into a string representation, which is then embedded into the prompt.
