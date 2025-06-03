import type { MCPTool } from '../types.js';

export async function loadTool(toolName: string): Promise<MCPTool> {
  try {
    console.log(`Loading tool: ${toolName}`);
    
    // Import the tool directly
    const modulePath = `./${toolName}.js`;
    console.log(`Importing from: ${modulePath}`);
    
    const toolModule = await import(modulePath);
    
    if (!toolModule || !toolModule.default) {
      throw new Error(`Tool ${toolName} does not have a default export`);
    }
    
    const tool = toolModule.default;
    
    if (typeof tool.run !== 'function') {
      throw new Error(`Tool ${toolName} does not export a valid run function`);
    }
    
    console.log(`Successfully loaded tool: ${toolName}`);
    return tool;
  } catch (error) {
    console.error(`Error loading tool ${toolName}:`, error);
    throw new Error(`Failed to load tool: ${toolName}. ${error instanceof Error ? error.message : String(error)}`);
  }
}
