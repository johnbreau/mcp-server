import type { MCPTool } from "../types.js";
import fs from 'fs-extra';
import fg from 'fast-glob';
import path from 'node:path';
import { embeddingService } from './embeddings.js';

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

interface WordCountResult {
  total: number;
  matches: Array<{
    path: string;
    count: number;
    title: string;
  }>;
}

type ObsidianParams = {
  action: 'search' | 'read' | 'list' | 'count' | 'index-vault';
  query?: string;
  path?: string;
  limit?: number;
  word?: string;
  caseSensitive?: boolean;
  semantic?: boolean;
};

export function getVaultPath(): string {
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
    const { 
      action, 
      query = '', 
      path: filePath = '', 
      limit = 10,
      word = '',
      caseSensitive = false,
      semantic = false
    } = params as ObsidianParams;
    
    // Initialize embedding service if not already done
    if (embeddingService && typeof embeddingService.initialize === 'function') {
      try {
        const vaultPath = getVaultPath();
        console.log(`Initializing embedding service for vault: ${vaultPath}`);
        await embeddingService.initialize(vaultPath);
        console.log('Embedding service initialized successfully');
      } catch (error) {
        console.error('Failed to initialize embedding service:', error);
        // Don't fail the entire request if embedding service fails to initialize
        // We'll fall back to non-semantic search
        console.warn('Falling back to non-semantic search due to embedding service initialization failure');
      }
    }

    try {
      switch (action) {
        case 'search':
          if (semantic) {
            // Use semantic search with embeddings
            const results = await embeddingService.searchSimilarNotes(query, limit);
            return {
              results: results.map(r => ({
                path: r.path,
                content: r.text,
                lastModified: new Date().toISOString(),
                size: r.text.length,
                score: r.score
              }))
            };
          } else {
            // Fall back to keyword search
            return await this.searchNotes(query, limit);
          }
          
        case 'read':
          // The filePath should be relative to the vault, not an absolute path
          return await this.readNote(filePath);
          
        case 'list':
          return await this.listNotes(filePath, limit);
          
        case 'count':
          if (!word) throw new Error('Word parameter is required for count action');
          return await this.countWordOccurrences(word, {
            caseSensitive: Boolean(caseSensitive),
            limit: limit
          });
          
        case 'index-vault':
          // Index all notes in the vault for semantic search
          const result = await embeddingService.indexVault();
          return { message: `Indexed ${result.processed} of ${result.total} notes` };
          
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
    try {
      const vaultPath = getVaultPath();
      console.log('=== Starting search ===');
      console.log(`Vault path: ${vaultPath}`);
      console.log(`Searching for: "${query}"`);
      console.log(`Directory exists: ${await fs.pathExists(vaultPath)}`);
      
      const results: SearchResult[] = [];
      
      // Check if vault directory exists
      if (!await fs.pathExists(vaultPath)) {
        console.error(`Vault directory does not exist: ${vaultPath}`);
        throw new Error(`Vault directory does not exist: ${vaultPath}`);
      }
      
      const searchTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
      if (searchTerms.length === 0) {
        console.log('No search terms provided');
        return { results: [] };
      }
      
      // Get all markdown files in the vault using the same pattern as listNotes
      const filePaths = await fg([
        `${vaultPath}/**/*.md`,
        `!${vaultPath}/**/node_modules/**`,
        `!${vaultPath}/**/.git/**`,
        `!${vaultPath}/**/.obsidian/**`,
        `!${vaultPath}/**/.*`,
        `!${vaultPath}/**/node_modules`,
        `!${vaultPath}/**/bower_components`,
        `!${vaultPath}/**/jspm_packages`,
        `!${vaultPath}/**/Thumbs.db`,
        `!${vaultPath}/**/ehthumbs.db`,
        `!${vaultPath}/**/Desktop.ini`
      ], {
        onlyFiles: true,
        caseSensitiveMatch: false,
        absolute: true,
        dot: false,
        followSymbolicLinks: false,
        unique: true
      });

      console.log(`Found ${filePaths.length} markdown files to search through`);

      // Process files in batches to avoid memory issues
      const BATCH_SIZE = 10;
      for (let i = 0; i < filePaths.length && results.length < limit * 2; i += BATCH_SIZE) {
        const batch = filePaths.slice(i, i + BATCH_SIZE);
        console.log(`Processing batch ${i / BATCH_SIZE + 1} of ${Math.ceil(filePaths.length / BATCH_SIZE)}`);
        
        const batchPromises = batch.map(async (filePath) => {
          try {
            const relativePath = path.relative(vaultPath, filePath);
            console.log(`Processing file: ${relativePath}`);
            
            // Skip files in the .obsidian directory
            if (relativePath.split(path.sep).includes('.obsidian')) {
              console.log(`Skipping file in .obsidian directory: ${relativePath}`);
              return null;
            }
            
            const content = await fs.readFile(filePath, 'utf-8');
            const lowerContent = content.toLowerCase();
            
            // Check if all search terms are in the content
            const allTermsFound = searchTerms.every(term => lowerContent.includes(term));
            if (!allTermsFound) return null;
            
            // Get an excerpt around the first match
            const firstTerm = searchTerms[0];
            const firstMatchPos = lowerContent.indexOf(firstTerm);
            if (firstMatchPos === -1) return null; // Shouldn't happen due to allTermsFound check
            
            const start = Math.max(0, firstMatchPos - 100);
            const end = Math.min(content.length, firstMatchPos + firstTerm.length + 100);
            let excerpt = content.substring(start, end);
            
            if (start > 0) excerpt = `...${excerpt}`;
            if (end < content.length) excerpt = `${excerpt}...`;
            
            const stats = await fs.stat(filePath).catch(() => null);
            
            console.log(`Found match in file: ${relativePath}`);
            
            return {
              path: relativePath.replace(/\.md$/i, ''), // Remove .md extension (case-insensitive)
              content: excerpt,
              lastModified: stats?.mtime?.toISOString() || new Date().toISOString(),
              size: content.length
            } as SearchResult;
          } catch (error) {
            console.error(`Error processing file ${filePath}:`, error);
            return null;
          }
        });

        const batchResults = (await Promise.all(batchPromises)).filter((r): r is SearchResult => r !== null);
        results.push(...batchResults);
      }
      
      // Sort by relevance
      const sortedResults = results.sort((a, b) => {
        // First sort by number of search terms found (descending)
        const aTermCount = searchTerms.reduce(
          (count, term) => count + (a.content.toLowerCase().includes(term.toLowerCase()) ? 1 : 0), 
          0
        );
        const bTermCount = searchTerms.reduce(
          (count, term) => count + (b.content.toLowerCase().includes(term.toLowerCase()) ? 1 : 0), 
          0
        );
        
        if (bTermCount !== aTermCount) {
          return bTermCount - aTermCount;
        }
        
        // Then by match density (more matches in shorter content is better)
        const aDensity = a.content.length / (a.content.split(/\s+/).length || 1);
        const bDensity = b.content.length / (b.content.split(/\s+/).length || 1);
        return aDensity - bDensity;
      });

      return {
        results: sortedResults.slice(0, limit)
      };
    } catch (error) {
      console.error('Error in searchNotes:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to search notes: ${errorMessage}`);
    }
  }

  private parseFrontmatter(content: string): { frontmatter: Record<string, any> | null; content: string } {
    const frontmatter: Record<string, any> = {};
    
    // Check if content has frontmatter
    if (!content.startsWith('---\n')) {
      return { frontmatter: null, content };
    }
    
    const endOfFrontmatter = content.indexOf('\n---', 4);
    if (endOfFrontmatter === -1) {
      return { frontmatter: null, content };
    }
    
    try {
      const frontmatterStr = content.slice(4, endOfFrontmatter);
      // Simple YAML parsing for basic key-value pairs
      frontmatterStr.split('\n').forEach(line => {
        const match = line.match(/^(\w+):\s*(.+)$/);
        if (match) {
          const [, key, value] = match;
          frontmatter[key] = value.trim();
        }
      });
      
      return {
        frontmatter: Object.keys(frontmatter).length > 0 ? frontmatter : null,
        content: content.slice(endOfFrontmatter + 4).trim()
      };
    } catch (e) {
      console.error('Error parsing frontmatter:', e);
      return { frontmatter: null, content };
    }
  }
  
  private processWikilinks(content: string): string {
    return content.replace(
      /\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/g, 
      (_match, link, display) => {
        const [notePath, heading] = link.split('|')[0].split('#');
        const displayText = display || notePath.split('/').pop() || notePath;
        return `[${displayText}](${encodeURIComponent(notePath)}${heading ? `#${encodeURIComponent(heading)}` : ''})`;
      }
    );
  }

  async readNote(filePath: string): Promise<ReadResult> {
    const vaultPath = getVaultPath();
    
    console.log(`Reading note: ${filePath} from vault: ${vaultPath}`);
    
    // Normalize the file path
    const normalizedPath = filePath.replace(/^[\\/]+/, '').replace(/\.md$/i, ''); // Case-insensitive .md removal
    
    // Try different possible file paths and extensions
    const possiblePaths = [
      `${normalizedPath}.md`,
      `${normalizedPath}/index.md`,
      path.join(normalizedPath, 'index.md'),
      path.join(path.dirname(normalizedPath), `${path.basename(normalizedPath)}.md`),
      path.join(vaultPath, `${normalizedPath}.md`),
      path.join(vaultPath, normalizedPath, 'index.md')
    ];
    
    console.log(`Trying paths:`, possiblePaths);
    
    let content = '';
    let stats = null;
    let foundPath = '';
    
    // Try each possible path
    for (const possiblePath of possiblePaths) {
      const fullPath = possiblePath.startsWith(vaultPath) ? possiblePath : path.join(vaultPath, possiblePath);
      console.log(`Trying path: ${fullPath}`);
      
      try {
        if (await fs.pathExists(fullPath)) {
          console.log(`Found file at: ${fullPath}`);
          content = await fs.readFile(fullPath, 'utf-8');
          stats = await fs.stat(fullPath);
          foundPath = fullPath;
          break;
        }
      } catch (error) {
        console.error(`Error accessing ${fullPath}:`, error);
      }
    }
    
    if (!stats) {
      const errorMsg = `Note not found: ${filePath}. Tried: ${possiblePaths.join(', ')}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    try {
      // Parse frontmatter and process content
      const { frontmatter, content: processedContent } = this.parseFrontmatter(content);
      const contentWithLinks = this.processWikilinks(processedContent);
      
      const result = {
        success: true,
        data: {
          path: foundPath.replace(/\.md$/i, ''), // Remove .md extension (case-insensitive)
          title: frontmatter?.title || path.basename(foundPath, '.md'),
          content: contentWithLinks,
          size: content.length,
          created: stats.birthtime.toISOString(),
          modified: stats.mtime.toISOString(),
          lastModified: stats.mtime.toISOString() // Alias for modified
        }
      };
      
      console.log(`Successfully read note: ${foundPath}`);
      console.log(`Content length: ${content.length} chars`);
      console.log(`Frontmatter:`, frontmatter);
      
      return result.data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error processing note:', errorMessage, error);
      throw new Error(`Failed to process note: ${errorMessage}`);
    }
  }

  /**
   * Counts occurrences of a specific word across all notes in the vault
   * @param word The word to search for
   * @param options Configuration options for the search
   * @returns Object containing total count and matches per file
   */
  async countWordOccurrences(
    word: string, 
    options: { caseSensitive?: boolean; limit?: number } = {}
  ): Promise<WordCountResult> {
    const { caseSensitive = false, limit = 100 } = options;
    const vaultPath = getVaultPath();
    
    try {
      // Get all markdown files in the vault
      const filePaths = await fg(`${vaultPath}/**/*.md`, {
        ignore: ['**/node_modules/**', '**/.git/**'],
        onlyFiles: true,
        caseSensitiveMatch: false,
        absolute: true,
        dot: false,
        followSymbolicLinks: true,
      });

      const results: Array<{ path: string; count: number; title: string }> = [];
      let totalCount = 0;
      const wordRegex = new RegExp(
        `\\b${word}\\b`,
        caseSensitive ? 'g' : 'gi'
      );

      // Process files up to the limit
      for (const filePath of filePaths.slice(0, limit)) {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const relativePath = path.relative(vaultPath, filePath);
          
          // Parse frontmatter to get title
          const { frontmatter, content: noteContent } = this.parseFrontmatter(content);
          const title = frontmatter?.title || path.basename(filePath, '.md');
          
          // Count occurrences
          const matches = noteContent.match(wordRegex) || [];
          const count = matches.length;
          
          if (count > 0) {
            totalCount += count;
            results.push({
              path: relativePath.replace(/\.md$/, ''),
              count,
              title
            });
          }
        } catch (error) {
          console.error(`Error processing file ${filePath}:`, error);
        }
      }

      // Sort by count (descending)
      results.sort((a, b) => b.count - a.count);

      return {
        total: totalCount,
        matches: results
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error counting word occurrences:', errorMessage);
      throw new Error(`Failed to count word occurrences: ${errorMessage}`);
    }
  }

  async listNotes(directory: string = '', limit: number = 10): Promise<ListResult> {
    const vaultPath = getVaultPath();
    console.log(`Vault path: ${vaultPath}`);
    
    // If no directory is specified, list all top-level directories in the vault
    const basePath = directory ? path.join(vaultPath, directory) : vaultPath;
    const fullPath = path.resolve(basePath);
    
    console.log(`Listing notes in: ${fullPath}`);

    // Verify the path is within the vault
    if (!fullPath.startsWith(vaultPath)) {
      throw new Error('Access denied: Path is outside the vault');
    }

    try {
      // First, try to list the directory contents to check if it exists
      try {
        await fs.access(fullPath);
      } catch (error) {
        console.error(`Directory does not exist or is not accessible: ${fullPath}`);
        return {
          path: directory,
          files: [],
          total: 0
        };
      }

      // Get all markdown files in the directory and its subdirectories
      const filePaths = await fg([
        `${basePath}/**/*.md`,
        `!${basePath}/**/node_modules/**`,
        `!${basePath}/**/.git/**`,
        `!${basePath}/**/.obsidian/**`
      ], {
        onlyFiles: true,
        caseSensitiveMatch: false,
        absolute: true,
        dot: false,
        followSymbolicLinks: false,
      });

      console.log(`Found ${filePaths.length} markdown files in ${fullPath}`);

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
          const relativePath = path.relative(vaultPath, filePath);
          
          // Skip files in the .obsidian directory
          if (relativePath.split(path.sep).includes('.obsidian')) {
            console.log(`Skipping file in .obsidian directory: ${relativePath}`);
            continue;
          }
          
          fileResults.push({
            path: relativePath.replace(/\.md$/, ''), // Remove .md extension for Obsidian-style paths
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

      console.log(`Successfully processed ${validFiles.length} files`);

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
