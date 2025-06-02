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

    try {
      switch (action) {
        case 'search':
          return await this.searchNotes(query, limit);
          
        case 'read':
          // The filePath should be relative to the vault, not an absolute path
          return await this.readNote(filePath);
          
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
      // Search for all files in the vault
      const files = await fg([`${searchPath}/**/*`], {
        ignore: [
          '**/.obsidian/**',
          '**/node_modules/**',
          '**/.git/**',
          '**/.DS_Store',
          '**/.*' // Skip hidden files/directories
        ],
        onlyFiles: true,
        caseSensitiveMatch: false,
        absolute: true,
        dot: false,
        followSymbolicLinks: true
      });

      console.log(`Found ${files.length} files to search through`);
      const searchTerm = query.toLowerCase();
      let filesProcessed = 0;
      let filesWithContent = 0;

      for (const filePath of files) {
        if (results.length >= limit) break;
        filesProcessed++;

        try {
          // Skip non-text files
          if (!['.md', '.txt', ''].includes(path.extname(filePath).toLowerCase())) {
            continue;
          }
          
          const stats = await fs.stat(filePath);
          
          // Skip files that are too large (> 1MB)
          if (stats.size > 1024 * 1024) {
            console.log(`Skipping large file: ${filePath} (${Math.round(stats.size / 1024)} KB)`);
            continue;
          }
          
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            filesWithContent++;
            
            if (content.toLowerCase().includes(searchTerm)) {
              // Get relative path from the vault root
              let relativePath = path.relative(searchPath, filePath);
              // Remove leading slashes or backslashes
              relativePath = relativePath.replace(/^[\\/]+/, '');
              
              console.log(`Found matching file: ${relativePath}`);
              
              results.push({
                path: relativePath.endsWith('.md') ? relativePath.slice(0, -3) : relativePath,
                content: content.slice(0, 200) + (content.length > 200 ? '...' : ''),
                lastModified: stats.mtime.toISOString(),
                size: content.length,
              });
            }
          } catch (error) {
            console.error(`Error reading file ${filePath}:`, error);
            continue;
          }
        } catch (error) {
          console.error(`Error processing file ${filePath}:`, error);
          continue;
        }
      }
      
      console.log(`Processed ${filesProcessed} files, found ${filesWithContent} with content, ${results.length} matches`);

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
    
    // Remove any leading slashes or backslashes to prevent path issues
    const cleanPath = filePath.replace(/^[\\/]+/, '');
    
    // Ensure the file has a .md extension if not already present
    const normalizedPath = cleanPath.endsWith('.md') ? cleanPath : `${cleanPath}.md`;
    const fullPath = path.join(vaultPath, normalizedPath);
    
    try {
      if (!(await fs.pathExists(fullPath))) {
        // Try without adding .md if the file already has it
        const altPath = cleanPath.endsWith('.md') 
          ? path.join(vaultPath, cleanPath.slice(0, -3))
          : fullPath;
        
        if (await fs.pathExists(altPath)) {
          const content = await fs.readFile(altPath, 'utf-8');
          const stats = await fs.stat(altPath);
          
          return {
            path: cleanPath,
            title: path.basename(altPath, '.md'),
            content,
            size: content.length,
            created: stats.birthtime.toISOString(),
            modified: stats.mtime.toISOString()
          };
        }
        
        throw new Error(`File not found in vault (${vaultPath}): ${filePath} (tried: ${fullPath} and ${altPath})`);
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
