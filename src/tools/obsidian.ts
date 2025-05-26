import { MCPTool } from "../types";
import fs from 'fs-extra';
import fg from 'fast-glob';
import path from 'path';

export interface SearchResult {
  path: string;
  content: string;
  lastModified: string;
  size: number;
}

export interface ListResult {
  path: string;
  files: Array<{
    path: string;
    name: string;
    size: number;
    modified?: string;
  }>;
  total: number;
}

export interface ReadResult {
  path: string;
  title: string;
  content: string;
  size: number;
  created?: string;
  modified?: string;
}

type ObsidianParams = {
  action: 'search' | 'read' | 'list';
  query?: string;
  path?: string;
  limit?: number;
};

function getVaultPath(): string {
  const vaultPath = process.env.OBSIDIAN_VAULT_PATH;
  if (!vaultPath) {
    console.error('OBSIDIAN_VAULT_PATH environment variable is not set. Please set it in your .env file.');
    throw new Error('OBSIDIAN_VAULT_PATH environment variable is not set');
  }
  return vaultPath;
}

class ObsidianTool implements MCPTool {
  name = 'obsidian';
  description = 'Interact with an Obsidian vault';
  
  async run(params: Record<string, any>): Promise<any> {
    const { action, query = '', path: filePath = '', limit = 10 } = params as ObsidianParams;
    const vaultPath = getVaultPath();
    const fullPath = path.join(vaultPath, filePath);

    try {
      switch (action) {
        case 'search':
          return await this.searchNotes(query, limit);
          
        case 'read':
          return await this.readNote(fullPath);
          
        case 'list':
          return await this.listNotes(filePath, limit);
          
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Obsidian tool error:', error.message);
        throw new Error(`Failed to ${action} in Obsidian vault: ${error.message}`);
      } else {
        console.error('Unknown error in Obsidian tool');
        throw new Error(`Failed to ${action} in Obsidian vault: Unknown error occurred`);
      }
    }
  }

  async searchNotes(query: string, limit: number = 5): Promise<{ results: SearchResult[] }> {
    console.log('searchNotes called with query:', { query, limit });
    if (!query) {
      console.log('Empty query, returning empty results');
      return { results: [] };
    }

    const searchPath = getVaultPath();
    console.log('Searching in vault path:', searchPath);
    const results: SearchResult[] = [];

    try {
      const files = await fg(`${searchPath}/**/*.md`, {
        ignore: ['**/.obsidian/**', '**/node_modules/**'],
        onlyFiles: true,
        caseSensitiveMatch: false,
        absolute: true,
        dot: false,
        followSymbolicLinks: true,
      });

      const searchTerm = query.toLowerCase();

      for (const file of files) {
        if (results.length >= limit) break;

        try {
          const content = await fs.readFile(file, 'utf-8');
          if (content.toLowerCase().includes(searchTerm)) {
            const relativePath = path.relative(searchPath, file);
            const stats = await fs.stat(file);
            results.push({
              path: relativePath,
              content: content.slice(0, 200) + (content.length > 200 ? '...' : ''),
              lastModified: stats.mtime.toISOString(),
              size: content.length,
            });
          }
        } catch (error) {
          console.error(`Error reading file ${file}:`, error);
          continue;
        }
      }

      return { results };
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error in searchNotes:', error.message);
        throw new Error(`Failed to search notes: ${error.message}`);
      } else {
        console.error('Unknown error in searchNotes');
        throw new Error('Failed to search notes: Unknown error occurred');
      }
    }
  }

  async readNote(filePath: string): Promise<ReadResult> {
    const vaultPath = getVaultPath();
    const fullPath = path.join(vaultPath, filePath);
    
    try {
      if (!(await fs.pathExists(fullPath))) {
        throw new Error(`File not found: ${filePath}`);
      }
      const content = await fs.readFile(fullPath, 'utf-8');
      const stats = await fs.stat(fullPath);
      
      return {
        path: filePath,
        title: path.basename(fullPath, '.md'),
        content,
        size: content.length,
        created: stats.birthtime.toISOString(),
        modified: stats.mtime.toISOString()
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error in readNote:', error.message);
        throw new Error(`Failed to read note: ${error.message}`);
      } else {
        console.error('Unknown error in readNote');
        throw new Error('Failed to read note: Unknown error occurred');
      }
    }
  }

  async listNotes(directory: string = '', limit: number = 10): Promise<ListResult> {
    const vaultPath = getVaultPath();
    const basePath = path.join(vaultPath, directory || '');
    const fullPath = path.resolve(basePath);

    // Verify the path is within the vault
    if (!fullPath.startsWith(vaultPath)) {
      throw new Error('Access denied: Path is outside the vault');
    }

    try {
      // Get all markdown files in the directory
      const filePaths = await fg(`${basePath}/**/*.md`, {
        ignore: ['**/node_modules/**', '**/.git/**'],
        onlyFiles: true,
        caseSensitiveMatch: false,
        absolute: true,
        dot: false,
        followSymbolicLinks: true,
      });

      // Process files up to the limit
      const filesToProcess = filePaths.slice(0, limit);
      const fileResults: Array<{
        path: string;
        name: string;
        size: number;
        modified: string;
      } | null> = [];

      for (const filePath of filesToProcess) {
        try {
          const stats = await fs.stat(filePath);
          fileResults.push({
            path: path.relative(vaultPath, filePath),
            name: path.basename(filePath, '.md'),
            size: stats.size,
            modified: stats.mtime.toISOString()
          });
        } catch (error) {
          console.error(`Error processing file ${filePath}:`, error);
          fileResults.push(null);
        }
      }

      // Filter out any null results from failed file processing
      const validFiles = fileResults.filter((file): file is NonNullable<typeof file> => file !== null);

      return {
        path: directory,
        files: validFiles,
        total: filePaths.length
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error in listNotes:', error.message);
        throw new Error(`Failed to list notes: ${error.message}`);
      } else {
        console.error('Unknown error in listNotes');
        throw new Error('Failed to list notes: Unknown error occurred');
      }
    }
  }

  getExcerpt(content: string, searchTerm: string, charsAround = 100): string {
    try {
      const lowerContent = content.toLowerCase();
      const termPos = lowerContent.indexOf(searchTerm.toLowerCase());
      
      if (termPos === -1) return '';
      
      const start = Math.max(0, termPos - charsAround);
      const end = Math.min(content.length, termPos + searchTerm.length + charsAround);
      
      let excerpt = content.substring(start, end);
      
      if (start > 0) {
        excerpt = `...${excerpt}`;
      }
      
      if (end < content.length) {
        excerpt = `${excerpt}...`;
      }
      
      return excerpt;
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error in getExcerpt:', error.message);
      } else {
        console.error('Unknown error in getExcerpt');
      }
      return '';
    }
  }
}

const obsidianTool = new ObsidianTool();
export default obsidianTool;
