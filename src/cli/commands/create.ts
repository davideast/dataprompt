import * as p from "@clack/prompts";
import color from "picocolors";
import { promises as fs } from "fs";
import path from "path";

export async function createProject(projectName: string) {
  const projectPath = path.resolve(projectName);
  const s = p.spinner();

  try {
    s.start("Creating project structure...");

    // create vscode settings
    await fs.mkdir(path.join(projectPath, ".vscode"), { recursive: true });
    await fs.writeFile(path.join(projectPath, ".vscode/settings.json"), JSON.stringify({
      "files.associations": {
        "*.prompt": "handlebars"
      },
    }))

    // Create project directories
    await fs.mkdir(path.join(projectPath, "prompts"), { recursive: true });
    await fs.mkdir(path.join(projectPath, "prompts/sharks"), { recursive: true });

    // Create _dev-flows.ts for Genkit dev UI
    const devFlowsContent = `// GENERATED - DO NOT MODIFY UNLESS YOU KNOW WHAT YOU ARE DOING
//             THEN HAVE FUN BUT JUST KNOW YOU CAN TOTALLY BREAK
//             THINGS. :)
import { dataprompt } from 'dataprompt';

const store = await dataprompt()

// Export flows with names matching their routes
export const flowExports = store.flows.list().reduce((acc, flow, index) => {
  acc[flow.name || \`flow$\{index}\`] = flow;
  return acc;
}, {} as any);
`;

    await fs.writeFile(path.join(projectPath, '_dev-flows.ts'), devFlowsContent);

    // Create schema.ts
    const schemaContent = `import { z } from "zod";

export const SharkFact = z.object({
  fact: z.string(),
  dateString: z.string().describe('ISO Date String')
})
    
export const HackerNewsAnalysisSchema = z.object({
  tldr: z.string().describe('The no-nonsense summary of the the main items of hacker news'),
  trends: z.array(z.string()).describe('Interesting trends in the topics seen on hacker news'),
  topics: z.array(z.string()).describe('The main topics being discussed across news items'),
  topThree: z.array(z.object({
    id: z.string(),
    title: z.string(),
    domain: z.string(),
    points: z.number(),
    date: z.string().describe('ISO Date String')
  }).describe('Hacker News Item'))
});
`;
    await fs.writeFile(path.join(projectPath, "schema.ts"), schemaContent);

    const promptContent = `---
model: googleai/gemini-2.0-flash
data.prompt:
  sources:
    fetch:
      news: https://api.hnpwa.com/v0/news/1.json
## if using firestore
#  result:
#    firestore:
#      push:
#        - ["/hackernews-items", news] 
#        - ["/analysis", output]
output:
  schema: HackerNewsAnalysisSchema
---
You are an expert at summarizing Hacker News articles. Given the following data, provide a concise summary of each article.

{{json news}}
`;
    await fs.writeFile(path.join(projectPath, "prompts/hn.prompt"), promptContent);

    const sharkPrompt = `---
model: googleai/gemini-2.0-flash
data.prompt:
  sources:
    firestore:
      shark: sharks/{{request.params.shark}}
      facts: "/facts"
  result:
    firestore:
      push:
        - ["/facts", output]
output:
  schema: SharkFact
---
Tell me a fact about the {{shark.type}} shark.
Today's date is {{dateFormat "today" format="yyyy-MM-dd"}}

Don't tell me these facts again:
{{#each facts as |doc|}}
  - {{doc.fact}}
{{/each}}`;
        await fs.writeFile(path.join(projectPath, "prompts/sharks/[shark].prompt"), sharkPrompt);

    // Create package.json
    const packageJson = {
      name: projectName,
      version: "0.0.0",
      type: "module",
      dependencies: {
        "dataprompt": "*",
        "genkit": "^1.0.4",
      },
      devDependencies: {
        "@types/express": "^4.17.21",
        "@types/node": "^20.11.19",
        "genkit-cli": "^1.0.4",
        "typescript": "^5.3.3",
        "tsx": "^4.7.1"
      },
      scripts: {
        "dev": "npm run build && dataprompt dev",
        "dev:ui": "genkit start -- tsx --watch _dev-flows.ts",
        "build": "tsc",
      }
    };
    await fs.writeFile(
      path.join(projectPath, "package.json"),
      JSON.stringify(packageJson, null, 2)
    );

    // Create .gitignore
    await fs.writeFile(path.join(projectPath, ".gitignore"),
      `node_modules\n.env\n*.log\ndist\n.genkit\n.env.example\nset_env.sh\n*-service-account.json\n*service-account*.json`);

    // Create tsconfig.json
    const tsconfigContent = {
      "compilerOptions": {
        "target": "ES2022",
        "module": "NodeNext",
        "moduleResolution": "NodeNext",
        "outDir": "./dist",
        "rootDir": "./",
        "strict": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "baseUrl": ".",
        "paths": {
          "@/*": ["./*"]
        }
      },
      "include": ["./**/*.ts"],
      "exclude": ["node_modules", "dist"]
    };
    await fs.writeFile(
      path.join(projectPath, "tsconfig.json"),
      JSON.stringify(tsconfigContent, null, 2)
    );

    // Create .env.example -  Include Firebase credentials
    await fs.writeFile(path.join(projectPath, "set_env.sh"),
      `#!/usr/bin/env bash

# source ./set_env.sh
export GOOGLEAI_API_KEY="<your-key>"
export GOOGLE_APPLICATION_CREDENTIALS="<./your-service-account.json>"
`);

    // Create README.md -  Hacker News and Firestore instructions
    const readmeContent = `# ${projectName}

## Setup

1.  **Install Dependencies:** \`npm install\`
2.  **Environment Variables:**
    *   Set your keys in the \`./set_env.sh\` file.
    *   **Gemini API:** Set \`GOOGLEAI_API_KEY=your-googleai-api-key\`
    *   **Firebase Service Account: Set \`GOOGLE_APPLICATION_CREDENTIALS=./your-service-account.json\`**
3.  Source the environment variables: \`source ./set_env.sh\`
4.  **Start the Server:** \`npm run dev\`

## Project Structure

-   \`prompts/hn.prompt\`: Fetches and stores Hacker News data.
-   \`prompts/sharks/[shark].prompt\`: Summarizes facts about sharks using a [shark] param.
-   \`schema.ts\`: Defines Zod schemas.
-   \`_dev-flows.ts\`: Exports all flows for the Genkit UI.

## Available Routes

-   \`GET /hn\`: Fetches Hacker News data for the given page.
-   \`GET /sharks/:shark\`: Summarizes facts about a specific shark and saves to Firestore.

## Development

\`\`\`bash
npm run dev  # Starts the dataprompt dev server
npm run dev:ui # Starts the Genkit UI
\`\`\`

`;
    await fs.writeFile(path.join(projectPath, "README.md"), readmeContent);

    s.stop(color.green("Project created successfully! 🚀"));

    const nextSteps = `cd ${projectName}
npm install
npm run dev`;

    p.note(nextSteps, "Next steps");
    p.outro(`Get help at ${color.underline(color.cyan("https://github.com/davideast/dataprompt"))}`);

    process.exit(0);

  } catch (error) {
    s.stop(color.red("Failed to create project"));
    p.log.error(String(error));
    process.exit(1);
  }
}
