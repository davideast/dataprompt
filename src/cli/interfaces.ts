export interface CliCommand {
  name: string;
  description: string;
  usage?: string;
  run: (args: string[]) => Promise<void>;
}
