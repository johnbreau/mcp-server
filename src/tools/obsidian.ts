import { MCPTool } from "../types";
import fs from 'fs-extra';
import fg from 'fast-glob';
import path from 'path';

interface SearchResult {
  path: string;
  title: string;
  excerpt: string;
  size: number;
  modified: Date;
}

interface ListResult {
  path: string;
  files: Array<{
    path: string;
    name: string;
    size: number;
    modified?: Date;
  }>;
  total: number;
}

interface ReadResult {
  path: string;
  title: string;
  content: string;
  size: number;
  created?: Date;
  modified?: Date;
}

type ObsidianParams = {
  action: 'search' | 'read' | 'list';
  query?: string;
  path?: string;
  limit?: number;
};

const OBSIDIAN_VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH || '';

if (!OBSIDIAN_VAULT_PATH) {
  console.warn('OBSIDIAN_VAULT_PATH environment variable is not set. Obsidian tool may not work correctly.');
}

class ObsidianTool implements MCPTool {
  name = 'obsidian';
  description = 'Interact with an Obsidian vault';
  
  async run(params: Record<string, any>): Promise<any> {
    const { action, query = '', path: filePath = '', limit = 10 } = params as ObsidianParams;
    
    if (!OBSIDIAN_VAULT_PATH) {
      throw new Error('OBSIDIAN_VAULT_PATH environment variable is not set');
    }

    const fullPath = path.join(OBSIDIAN_VAULT_PATH, filePath);

    try {
      switch (action) {
        case 'search':
          return await this.searchNotes(query, limit);
          
        case 'read':
          return await this.readNote(fullPath);
          
        case 'list':
          return await this.listNotes(fullPath, limit);
          
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

  async searchNotes(query: string, limit: number): Promise<{ results: SearchResult[] }> {
    if (!query) {
      throw new Error('Search query is required');
    }

    try {
      const files = await fg('**/*.md', {
        cwd: OBSIDIAN_VAULT_PATH,
        ignore: ['**/.obsidian/**', '**/node_modules/**'],
        absolute: true,
        onlyFiles: true,
      });

      const results: SearchResult[] = [];
      const searchTerm = query.toLowerCase();
      
      for (const file of files) {
        if (results.length >= limit) break;
        
        try {
          const content = await fs.readFile(file, 'utf-8');
          if (content.toLowerCase().includes(searchTerm)) {
            const relativePath = path.relative(OBSIDIAN_VAULT_PATH, file);
            results.push({
              path: relativePath,
              title: path.basename(file, '.md'),
              excerpt: this.getExcerpt(content, searchTerm),
              size: content.length,
              modified: (await fs.stat(file)).mtime
            });
          }
        } catch (error: unknown) {
          if (error instanceof Error) {
            console.warn(`Error reading file ${file}:`, error.message);
          } else {
            console.warn(`Error reading file ${file}:`, String(error));
          }
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
    try {
      if (!(await fs.pathExists(filePath))) {
        throw new Error(`File not found: ${filePath}`);
      }

      const content = await fs.readFile(filePath, 'utf-8');
      const stats = await fs.stat(filePath);
      
      return {
        path: path.relative(OBSIDIAN_VAULT_PATH, filePath),
        title: path.basename(filePath, '.md'),
        content,
        size: content.length,
        created: stats.birthtime,
        modified: stats.mtime,
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

  async listNotes(directory: string, limit: number): Promise<ListResult> {
    try {
      const fullPath = path.join(OBSIDIAN_VAULT_PATH, directory);
      
      if (!(await fs.pathExists(fullPath))) {
        throw new Error(`Directory not found: ${directory}`);
      }

      const files = await fg('**/*.md', {
        cwd: fullPath,
        ignore: ['**/.obsidian/**', '**/node_modules/**'],
        onlyFiles: true,
        stats: true,
      });

      return {
        path: directory,
        files: files.slice(0, limit).map(file => ({
          path: file.path,
          name: path.basename(file.path, '.md'),
          size: file.stats?.size || 0,
          modified: file.stats?.mtime,
        })),
        total: files.length,
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
