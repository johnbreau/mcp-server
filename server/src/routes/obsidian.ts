import { Router } from 'express';
import { promises as fs } from 'fs';
import path from 'path';

const router = Router();

// Vault path will be determined by environment variable or default

// Helper function to get vault path from environment or use default
const getVaultPath = () => {
  const vaultPath = process.env.OBSIDIAN_VAULT_PATH || 
    path.join(process.env.HOME || process.env.USERPROFILE || '', 'Obsidian');
  console.log('Using Obsidian vault path:', vaultPath);
  return vaultPath;
};

// Search notes by content
router.post('/', async (req, res) => {
  try {
    const { action, query, limit = 5, directory = '' } = req.body;
    const vaultPath = getVaultPath();
    const searchDir = path.join(vaultPath, directory);

    if (action === 'search') {
      console.log(`Searching for: "${query}" in ${searchDir}`);
      const results = [];
      const searchQuery = query.toLowerCase().trim();
      
      // Increase the limit significantly to find more matches
      const maxFilesToSearch = 1000; // Maximum number of files to search through
      const files = await findMarkdownFiles(searchDir, maxFilesToSearch);
      
      console.log(`Found ${files.length} markdown files in total`);
      
      // If no files found, log directory contents for debugging
      if (files.length === 0) {
        try {
          const dirContents = await fs.readdir(searchDir, { withFileTypes: true });
          console.log(`Directory contents (${searchDir}):`, dirContents.map(d => ({
            name: d.name,
            isDirectory: d.isDirectory(),
            isFile: d.isFile()
          })));
        } catch (err) {
          console.error(`Error reading directory ${searchDir}:`, err);
        }
      }
      
      for (const file of files) {
        if (results.length >= limit) break;
        
        try {
          const relativePath = path.relative(vaultPath, file);
          const fileName = path.basename(file);
          const content = await fs.readFile(file, 'utf-8');
          
          // Search in both filename and content
          const fileNameMatch = fileName.toLowerCase().includes(searchQuery);
          const contentMatch = content.toLowerCase().includes(searchQuery);
          
          if (fileNameMatch || contentMatch) {
            console.log(`Found match in file: ${relativePath}`);
            const stats = await fs.stat(file);
            
            // Get a snippet of the content around the match
            let contentSnippet = '';
            if (contentMatch) {
              const matchIndex = content.toLowerCase().indexOf(searchQuery);
              const start = Math.max(0, matchIndex - 50);
              const end = Math.min(content.length, matchIndex + searchQuery.length + 50);
              contentSnippet = content.substring(start, end);
            } else {
              // If only filename matches, just take the first 100 chars
              contentSnippet = content.substring(0, 100) + (content.length > 100 ? '...' : '');
            }
            
            results.push({
              path: relativePath,
              content: contentSnippet,
              lastModified: stats.mtime.toISOString(),
              size: stats.size,
              score: fileNameMatch ? 1 : 0.5 // Higher score for filename matches
            });
          }
        } catch (error) {
          console.error(`Error reading file ${file}:`, error);
        }
      }
      
      return res.json({ success: true, results });
    } else if (action === 'list') {
      // List files in directory
      try {
        const files = await fs.readdir(searchDir, { withFileTypes: true });
        const markdownFiles = files
          .filter(file => file.isFile() && file.name.endsWith('.md'))
          .slice(0, limit)
          .map(file => ({
            path: path.relative(vaultPath, path.join(searchDir, file.name)),
            name: path.basename(file.name, '.md'),
            modified: new Date().toISOString(), // Would need actual modification time
            size: 0 // Would need actual file size
          }));
          
        return res.json({ success: true, files: markdownFiles });
      } catch (error) {
        console.error('Error listing directory:', error);
        return res.status(500).json({ success: false, error: 'Error listing directory' });
      }
    } else {
      return res.status(400).json({ success: false, error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Error in Obsidian API:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Helper function to find markdown files recursively
async function findMarkdownFiles(dir: string, limit: number, results: string[] = [], depth = 0, processedDirs = new Set<string>()): Promise<string[]> {
  // Normalize the directory path to handle any . or .. in the path
  const normalizedDir = path.normalize(dir);
  
  // Skip if we've already processed this directory (prevents infinite loops with symlinks)
  if (processedDirs.has(normalizedDir)) {
    return results;
  }
  processedDirs.add(normalizedDir);
  
  // Check limits
  if (results.length >= limit) return results;
  if (depth > 20) { // Increased depth limit for nested vaults
    console.warn(`Maximum directory depth (${depth}) reached at: ${normalizedDir}`);
    return results;
  }
  
  // Skip system directories that typically don't contain notes
  const skipDirs = ['.git', '.obsidian', 'node_modules', '.trash', '.github', '.vscode'];
  const dirName = path.basename(normalizedDir);
  if (skipDirs.includes(dirName) || dirName.startsWith('_')) {
    return results;
  }
  
  try {
    const entries = await fs.readdir(normalizedDir, { withFileTypes: true });
    
    // Process files first
    await Promise.all(entries.map(async (entry) => {
      if (results.length >= limit) return;
      
      const fullPath = path.join(normalizedDir, entry.name);
      
      try {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          results.push(fullPath);
        }
      } catch (err) {
        console.error(`Error processing ${fullPath}:`, err);
      }
    }));
    
    // Then process directories (breadth-first)
    for (const entry of entries) {
      if (results.length >= limit) break;
      
      const fullPath = path.join(normalizedDir, entry.name);
      
      try {
        const stats = await fs.lstat(fullPath);
        
        // Handle symlinks
        if (stats.isSymbolicLink()) {
          try {
            const realPath = await fs.realpath(fullPath);
            const realStats = await fs.lstat(realPath);
            if (realStats.isDirectory()) {
              await findMarkdownFiles(realPath, limit, results, depth + 1, processedDirs);
            }
          } catch (err) {
            console.error(`Error resolving symlink ${fullPath}:`, err);
          }
        } 
        // Handle regular directories
        else if (entry.isDirectory() && !entry.name.startsWith('.')) {
          await findMarkdownFiles(fullPath, limit, results, depth + 1, processedDirs);
        }
      } catch (err) {
        console.error(`Error processing ${fullPath}:`, err);
      }
    }
    
    return results;
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
    return results;
  }
}

// Get note content
router.get('/note', async (req, res) => {
  try {
    const { path: notePath } = req.query;
    if (!notePath || typeof notePath !== 'string') {
      return res.status(400).json({ success: false, error: 'Path is required' });
    }
    
    const vaultPath = getVaultPath();
    const fullPath = path.join(vaultPath, notePath);
    
    // Basic security check to prevent directory traversal
    if (!fullPath.startsWith(vaultPath)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    
    const content = await fs.readFile(fullPath, 'utf-8');
    return res.json({ success: true, content });
  } catch (error) {
    console.error('Error reading note:', error);
    return res.status(500).json({ success: false, error: 'Error reading note' });
  }
});

export default router;
