export interface MCPTool {
  name: string;
  description?: string;
  run: (params: Record<string, any>) => Promise<any>;
}