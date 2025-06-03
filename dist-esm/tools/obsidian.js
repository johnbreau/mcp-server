import fs from 'fs-extra';
import fg from 'fast-glob';
import path from 'node:path';
import { embeddingService } from './embeddings.js';
export function getVaultPath() {
    const vaultPath = process.env.OBSIDIAN_VAULT_PATH;
    if (!vaultPath) {
        console.error('OBSIDIAN_VAULT_PATH environment variable is not set. Please set it in your .env file.');
        throw new Error('OBSIDIAN_VAULT_PATH environment variable is not set');
    }
    return vaultPath;
}
class ObsidianTool {
    constructor() {
        this.name = 'obsidian';
        this.description = 'Interact with an Obsidian vault';
    }
    async run(params) {
        const { action, query = '', path: filePath = '', limit = 10, word = '', caseSensitive = false, semantic = false } = params;
        if (embeddingService && typeof embeddingService.initialize === 'function') {
            try {
                const vaultPath = getVaultPath();
                console.log(`Initializing embedding service for vault: ${vaultPath}`);
                await embeddingService.initialize(vaultPath);
                console.log('Embedding service initialized successfully');
            }
            catch (error) {
                console.error('Failed to initialize embedding service:', error);
                console.warn('Falling back to non-semantic search due to embedding service initialization failure');
            }
        }
        try {
            switch (action) {
                case 'search':
                    if (semantic) {
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
                    }
                    else {
                        return await this.searchNotes(query, limit);
                    }
                case 'read':
                    return await this.readNote(filePath);
                case 'list':
                    return await this.listNotes(filePath, limit);
                case 'count':
                    if (!word)
                        throw new Error('Word parameter is required for count action');
                    return await this.countWordOccurrences(word, {
                        caseSensitive: Boolean(caseSensitive),
                        limit: limit
                    });
                case 'index-vault':
                    const result = await embeddingService.indexVault();
                    return { message: `Indexed ${result.processed} of ${result.total} notes` };
                default:
                    throw new Error(`Unknown action: ${action}`);
            }
        }
        catch (error) {
            if (error instanceof Error) {
                console.error('Obsidian tool error:', error.message);
                throw new Error(`Failed to ${action} in Obsidian vault: ${error.message}`);
            }
            else {
                console.error('Unknown error in Obsidian tool');
                throw new Error(`Failed to ${action} in Obsidian vault: Unknown error occurred`);
            }
        }
    }
    async searchNotes(query, limit = 5) {
        try {
            const vaultPath = getVaultPath();
            const searchPath = vaultPath;
            console.log('=== Starting search ===');
            console.log(`Vault path: ${vaultPath}`);
            console.log(`Searching for: "${query}"`);
            console.log(`Directory exists: ${await fs.pathExists(vaultPath)}`);
            const results = [];
            if (!await fs.pathExists(vaultPath)) {
                console.error(`Vault directory does not exist: ${vaultPath}`);
                throw new Error(`Vault directory does not exist: ${vaultPath}`);
            }
            const searchTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
            if (searchTerms.length === 0) {
                console.log('No search terms provided');
                return { results: [] };
            }
            const files = await fg(`${searchPath}/**/*.{md,mdx}`, {
                ignore: [
                    '**/node_modules/**',
                    '**/.git/**',
                    '**/.obsidian/**',
                    '**/.*',
                    '**/node_modules',
                    '**/bower_components',
                    '**/jspm_packages',
                    '**/Thumbs.db',
                    '**/ehthumbs.db',
                    '**/Desktop.ini'
                ],
                onlyFiles: true,
                caseSensitiveMatch: false,
                absolute: true,
                dot: false,
                followSymbolicLinks: false,
                stats: false,
                unique: true
            });
            console.log(`Found ${files.length} files to search through`);
            const BATCH_SIZE = 20;
            for (let i = 0; i < files.length && results.length < limit * 2; i += BATCH_SIZE) {
                const batch = files.slice(i, i + BATCH_SIZE);
                const batchPromises = batch.map(async (filePath) => {
                    try {
                        const content = await fs.readFile(filePath, 'utf-8');
                        const lowerContent = content.toLowerCase();
                        const allTermsFound = searchTerms.every(term => lowerContent.includes(term));
                        if (!allTermsFound)
                            return null;
                        const firstTerm = searchTerms[0];
                        const firstMatchPos = lowerContent.indexOf(firstTerm);
                        if (firstMatchPos === -1)
                            return null;
                        const start = Math.max(0, firstMatchPos - 100);
                        const end = Math.min(content.length, firstMatchPos + firstTerm.length + 100);
                        let excerpt = content.substring(start, end);
                        if (start > 0)
                            excerpt = `...${excerpt}`;
                        if (end < content.length)
                            excerpt = `${excerpt}...`;
                        const stats = await fs.stat(filePath).catch(() => null);
                        return {
                            path: path.relative(vaultPath, filePath).replace(/\.md$/, ''),
                            content: excerpt,
                            lastModified: stats?.mtime?.toISOString() || new Date().toISOString(),
                            size: content.length
                        };
                    }
                    catch (error) {
                        console.error(`Error processing file ${filePath}:`, error);
                        return null;
                    }
                });
                const batchResults = (await Promise.all(batchPromises)).filter((r) => r !== null);
                results.push(...batchResults);
            }
            const sortedResults = results.sort((a, b) => {
                const aTermCount = searchTerms.reduce((count, term) => count + (a.content.toLowerCase().includes(term.toLowerCase()) ? 1 : 0), 0);
                const bTermCount = searchTerms.reduce((count, term) => count + (b.content.toLowerCase().includes(term.toLowerCase()) ? 1 : 0), 0);
                if (bTermCount !== aTermCount) {
                    return bTermCount - aTermCount;
                }
                const aDensity = a.content.length / (a.content.split(/\s+/).length || 1);
                const bDensity = b.content.length / (b.content.split(/\s+/).length || 1);
                return aDensity - bDensity;
            });
            return {
                results: sortedResults.slice(0, limit)
            };
        }
        catch (error) {
            console.error('Error in searchNotes:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to search notes: ${errorMessage}`);
        }
    }
    parseFrontmatter(content) {
        const frontmatter = {};
        if (!content.startsWith('---\n')) {
            return { frontmatter: null, content };
        }
        const endOfFrontmatter = content.indexOf('\n---', 4);
        if (endOfFrontmatter === -1) {
            return { frontmatter: null, content };
        }
        try {
            const frontmatterStr = content.slice(4, endOfFrontmatter);
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
        }
        catch (e) {
            console.error('Error parsing frontmatter:', e);
            return { frontmatter: null, content };
        }
    }
    processWikilinks(content) {
        return content.replace(/\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/g, (_match, link, display) => {
            const [notePath, heading] = link.split('|')[0].split('#');
            const displayText = display || notePath.split('/').pop() || notePath;
            return `[${displayText}](${encodeURIComponent(notePath)}${heading ? `#${encodeURIComponent(heading)}` : ''})`;
        });
    }
    async readNote(filePath) {
        const vaultPath = getVaultPath();
        const normalizedPath = filePath.replace(/^[\\/]+/, '').replace(/\.md$/, '');
        const possiblePaths = [
            `${normalizedPath}.md`,
            `${normalizedPath}/index.md`,
            path.join(normalizedPath, 'index.md'),
            path.join(path.dirname(normalizedPath), `${path.basename(normalizedPath)}.md`)
        ];
        let content = '';
        let stats = null;
        let foundPath = '';
        for (const possiblePath of possiblePaths) {
            const fullPath = path.join(vaultPath, possiblePath);
            try {
                if (await fs.pathExists(fullPath)) {
                    content = await fs.readFile(fullPath, 'utf-8');
                    stats = await fs.stat(fullPath);
                    foundPath = possiblePath;
                    break;
                }
            }
            catch (error) {
                console.error(`Error accessing ${fullPath}:`, error);
            }
        }
        if (!stats) {
            throw new Error(`Note not found: ${filePath}. Tried: ${possiblePaths.join(', ')}`);
        }
        try {
            const { frontmatter, content: processedContent } = this.parseFrontmatter(content);
            const contentWithLinks = this.processWikilinks(processedContent);
            return {
                path: foundPath.replace(/\.md$/, ''),
                title: frontmatter?.title || path.basename(foundPath, '.md'),
                content: contentWithLinks,
                size: content.length,
                created: stats.birthtime.toISOString(),
                modified: stats.mtime.toISOString()
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Error processing note:', errorMessage);
            throw new Error(`Failed to process note: ${errorMessage}`);
        }
    }
    async countWordOccurrences(word, options = {}) {
        const { caseSensitive = false, limit = 100 } = options;
        const vaultPath = getVaultPath();
        try {
            const filePaths = await fg(`${vaultPath}/**/*.md`, {
                ignore: ['**/node_modules/**', '**/.git/**'],
                onlyFiles: true,
                caseSensitiveMatch: false,
                absolute: true,
                dot: false,
                followSymbolicLinks: true,
            });
            const results = [];
            let totalCount = 0;
            const wordRegex = new RegExp(`\\b${word}\\b`, caseSensitive ? 'g' : 'gi');
            for (const filePath of filePaths.slice(0, limit)) {
                try {
                    const content = await fs.readFile(filePath, 'utf-8');
                    const relativePath = path.relative(vaultPath, filePath);
                    const { frontmatter, content: noteContent } = this.parseFrontmatter(content);
                    const title = frontmatter?.title || path.basename(filePath, '.md');
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
                }
                catch (error) {
                    console.error(`Error processing file ${filePath}:`, error);
                }
            }
            results.sort((a, b) => b.count - a.count);
            return {
                total: totalCount,
                matches: results
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Error counting word occurrences:', errorMessage);
            throw new Error(`Failed to count word occurrences: ${errorMessage}`);
        }
    }
    async listNotes(directory = '', limit = 10) {
        const vaultPath = getVaultPath();
        const basePath = path.join(vaultPath, directory || '');
        const fullPath = path.resolve(basePath);
        if (!fullPath.startsWith(vaultPath)) {
            throw new Error('Access denied: Path is outside the vault');
        }
        try {
            const filePaths = await fg(`${basePath}/**/*.md`, {
                ignore: ['**/node_modules/**', '**/.git/**'],
                onlyFiles: true,
                caseSensitiveMatch: false,
                absolute: true,
                dot: false,
                followSymbolicLinks: true,
            });
            const filesToProcess = filePaths.slice(0, limit);
            const fileResults = [];
            for (const filePath of filesToProcess) {
                try {
                    const stats = await fs.stat(filePath);
                    fileResults.push({
                        path: path.relative(vaultPath, filePath),
                        name: path.basename(filePath, '.md'),
                        size: stats.size,
                        modified: stats.mtime.toISOString()
                    });
                }
                catch (error) {
                    console.error(`Error processing file ${filePath}:`, error);
                    fileResults.push(null);
                }
            }
            const validFiles = fileResults.filter((file) => file !== null);
            return {
                path: directory,
                files: validFiles,
                total: filePaths.length
            };
        }
        catch (error) {
            if (error instanceof Error) {
                console.error('Error in listNotes:', error.message);
                throw new Error(`Failed to list notes: ${error.message}`);
            }
            else {
                console.error('Unknown error in listNotes');
                throw new Error('Failed to list notes: Unknown error occurred');
            }
        }
    }
    getExcerpt(content, searchTerm, charsAround = 100) {
        try {
            const lowerContent = content.toLowerCase();
            const termPos = lowerContent.indexOf(searchTerm.toLowerCase());
            if (termPos === -1)
                return '';
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
        }
        catch (error) {
            if (error instanceof Error) {
                console.error('Error in getExcerpt:', error.message);
            }
            else {
                console.error('Unknown error in getExcerpt');
            }
            return '';
        }
    }
}
const obsidianTool = new ObsidianTool();
export default obsidianTool;
//# sourceMappingURL=obsidian.js.map