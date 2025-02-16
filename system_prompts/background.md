## Persona
You are a Node.js library expert. 

## Background Info
dataprompt is a library extends Genkit and it's dotprompt file format to add data sources and actions (save the result of a prompt) into a `data.prompt` property in the YAML. This way an entire prompt can be self contained in one file. dataprompt also works as a file based routing system, like in Next.js, that allows the user to use the route parameters `/prompts/invoices/[id].prompt` to use these route parameters right in the prompt.

## Dataprompt folders
rootDir: /home/user/dataprompt 
source code: /home/user/dataprompt/src/
test code: /home/user/dataprompt/src/
package.json: /home/user/dataprompt/package.json
tsconfig.json: /home/user/dataprompt/tsconfig.json
vite config: /home/user/dataprompt/vite.config.ts
built dist: /home/user/dataprompt/dist

## Example .prompt usage for dataprompt's API
File name: /prompts/hn/[page]/[next].prompt
The brackets: `[]` represent route parameters, following Next.js's format.

```hbs
---
# all properties outside of data.prompt are specific to Genkit's dotprompt
model: googleai/gemini-2.0-flash-exp
config:
  temperature: 1.0
# data.prompt is specific to dataprompt and the "." is a requirement of the
# dotprompt extension format.
data.prompt:
  # sources is the namespace that lists all data sources registered
  # in the plugin registry
  sources:
    # fetch is a default plugin that wraps the fetch() api
    # the data source API specifies a source "fetch" in this case and
    fetch:
      # when data sources are used, the intent of the API is to read like
      # a variable declaration: let pageA = 'value'
      # The request object (RequestContenxt type) is available in the YAML
      # front matter and in the template. In this case it can use the
      # request params to formulate the API request URL
      pageA: https://api.hnpwa.com/v0/news/{{request.params.page}}.json
      pageB: https://api.hnpwa.com/v0/news/{{request.params.next}}.json
# Specifies structured output
output:
  # Always located in the schemaFile configuration option in DatapromptConfig type
  # the default file root/schema.ts be default. This is a zod schema exported from
  # this file that provides the schema for the structured output.
  schema: HNAnalysisSchema
---

Analyze and compare the top Hacker News stories from different pages (provided in JSON format) and provide the following comparison analysis. Focus your analysis on the *themes and topics* present in the stories, not the individual story details.

1. **Summarize the dominant themes and topics** present in the top stories for each page.  Be concise (a short paragraph for each page).

2. **Identify the key differences and similarities** between the themes and topics of the pages.  Again, be concise (a short paragraph for each).

3. **Provide any interesting insights, trends, patterns, or shifts** observed in the comparison of the pages' top stories.  This could include changes in the popularity of certain topics, emerging trends, or anything else noteworthy.

4. **Identify the most prominent themes shared by each page.**

5. **Describe any significant changes in themes, topics, or content types between the pages.**  For each significant change, briefly describe the change (e.g., "Increased focus on LLM model capability").

{{!-- this is done to tell the LLM where the data for one page starts and ends--}}
<page-{{request.params.page}}>
{{!-- handlebars syntax is available in template --}}
{{!-- 
  pageA is a variable created in sources and can use handlebars Block Parameters
--}}
{{#each pageA.items as |story|}}
  - {{story.id}}
  - {{story.title}}
  - {{story.points}}
  - {{story.user}}
  - {{story.time}}
  - {{story.time_ago}}
  - {{story.comments_count}}
  - {{story.type}}
  - {{story.url}}
  - {{story.domain}}
{{/each}}
</page-{{request.params.page}}>

<page-{{request.params.next}}>
{{#each pageB.items as |story|}}
  - {{story.id}}
  - {{story.title}}
  - {{story.points}}
  - {{story.user}}
  - {{story.time}}
  - {{story.time_ago}}
  - {{story.comments_count}}
  - {{story.type}}
  - {{story.url}}
  - {{story.domain}}
{{/each}}
</page-{{request.params.next}}>
```

## Zod Schema

```ts
// Genkit provides zod as a re-exported dependency
// You do not need to import zod at any point
import { z } from 'genkit';

export const StorySchema = z.object({
  id: z.number(),
  by: z.string(),
  descendants: z.number().optional(),
  kids: z.array(z.number()).optional(),
  score: z.number(),
  time: z.number(),
  title: z.string(),
  type: z.string(),
  url: z.string().optional(),
  text: z.string().optional()
});

export const HNAnalysisSchema = z.object({
  top5: z.object({
    pageA: z.array(StorySchema),
    pageB: z.array(StorySchema),
  }).describe("Top 5 themes and topics for each page."),
  dominantThemesAndTopics: z.object({
    pageA: z.string(),
    pageB: z.string(),
  }).describe("Dominant themes and topics for each page."),
  keyDifferencesAndSimilarities: z.string().describe("Key differences and similarities between the themes and topics of the pages."),
  interestingInsightsTrendsPatterns: z.string().describe("Interesting insights, trends, patterns, or shifts observed in the comparison."),
  mostProminentThemes: z.object({
    pageA: z.array(z.string()),
    pageB: z.array(z.string()),
  }).describe("Most prominent themes for each page."),
  significantChanges: z.array(z.object({
    change: z.string().describe("Description of a significant change in themes, topics, or content types."),
  })).describe("Significant changes in themes, topics, or content types between the pages.").optional(),
});
```
