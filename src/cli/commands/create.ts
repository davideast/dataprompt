import * as p from "@clack/prompts";
import color from "picocolors";
import { promises as fs } from "fs";
import path from "path";

export async function createProject(projectName: string) {
  const projectPath = path.resolve(projectName);
  const s = p.spinner();

  try {
    s.start("Creating project structure...");

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
model: googleai/gemini-2.0-flash-exp
data.prompt:
  sources:
    fetch:
      news: https://api.hnpwa.com/v0/news/1.json
  result:
    firestore:
      push:
        - ["/hackernews-items", news] 
        - ["/analysis", output]
output:
  schema: HackerNewsAnalysisSchema
---
You are an expert at summarizing Hacker News articles.  Given the following data, provide a concise summary of each article.

{{news}}
`;
    await fs.writeFile(path.join(projectPath, "prompts/hn.prompt"), promptContent);

    const sharkPrompt = `---
model: googleai/gemini-2.0-flash-exp
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
        "genkit": "^0.9.12",
      },
      devDependencies: {
        "@types/express": "^4.17.21",
        "@types/node": "^20.11.19",
        "genkit-cli": "^0.9.12",
        "typescript": "^5.3.3",
        "tsx": "^4.7.1"
      },
      scripts: {
        "dev": "dataprompt dev",
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
      `node_modules\n.env\n*.log\ndist\n.genkit\n.env.example`);

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
    await fs.writeFile(path.join(projectPath, ".env.example"),
      `GOOGLEAI_API_KEY=YOUR_GOOGLEAI_API_KEY_HERE
      GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
`);

    // Create README.md -  Hacker News and Firestore instructions
    const readmeContent = `# ${projectName}

## Setup

1.  **Install Dependencies:** \`npm install\`
2.  **Environment Variables:**
    *   Create a \`.env\` file (or copy \`.env.example\`).
    *   **Google AI:** Set \`GOOGLEAI_API_KEY=your-googleai-api-key\`

## Project Structure

-   \`prompts/hackernews/\`
    -   \`[page].prompt\`: Fetches and stores Hacker News data.
-   \`schema.ts\`: Defines Zod schemas.
-   \`_dev-flows.ts\`: For Genkit UI.

## Available Routes

-   \`POST /hackernews/:page\`: Fetches Hacker News data for the given page and saves it to Firestore. The \`:page\` is a dynamic route parameter.  Try \`/hackernews/1\`, \`/hackernews/2\`, etc.

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
