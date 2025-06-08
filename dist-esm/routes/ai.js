import { Router } from 'express';
import path from 'path';
import { AIService } from '../services/aiService.js';
import { api } from '../api/obsidian.js';
const router = Router();
router.use((_req, res, next) => {
    res.apiSuccess = function (data, statusCode = 200) {
        const response = { success: true, data };
        this.status(statusCode).json(response);
    };
    res.apiError = function (message, statusCode = 500) {
        const response = { success: false, error: message };
        this.status(statusCode).json(response);
    };
    next();
});
router.use((err, _req, res, _next) => {
    console.error('Error:', err);
    res.apiError('Internal server error', 500);
});
const semanticSearchHandler = async (req, res, next) => {
    try {
        const { query, limit = 5 } = req.body;
        if (!query || typeof query !== 'string' || query.trim() === '') {
            return res.apiError('Query must be a non-empty string', 400);
        }
        console.log(`[${new Date().toISOString()}] Starting semantic search for query: "${query}"`);
        try {
            const exactMatches = await api.searchNotes(query, 10);
            if (exactMatches && exactMatches.length > 0) {
                console.log(`Found ${exactMatches.length} exact matches`);
                return res.apiSuccess({
                    results: exactMatches,
                    reasoning: 'Found matching notes using basic text search.',
                    total: exactMatches.length,
                    searchType: 'exact'
                });
            }
        }
        catch (searchError) {
            console.warn('Basic search failed, falling back to semantic search:', searchError);
        }
        console.log('No exact matches found, falling back to semantic search');
        try {
            console.log('Fetching recent notes...');
            const recentNotes = await api.listNotes('', 20);
            console.log('Recent notes:', JSON.stringify(recentNotes, null, 2));
            if (!Array.isArray(recentNotes) || recentNotes.length === 0) {
                console.log('No notes found in the vault');
                return res.apiSuccess({
                    results: [],
                    reasoning: 'No notes found in the vault.',
                    total: 0,
                    searchType: 'none'
                });
            }
            console.log(`Processing ${recentNotes.length} recent notes for semantic search`);
            const notesWithContent = [];
            const BATCH_SIZE = 5;
            for (let i = 0; i < recentNotes.length; i += BATCH_SIZE) {
                const batch = recentNotes.slice(i, i + BATCH_SIZE);
                const batchPromises = batch.map(async (note) => {
                    try {
                        const content = await api.getNote(note.path);
                        return {
                            path: note.path,
                            content: content.content,
                            lastModified: note.modified || new Date().toISOString(),
                            size: note.size || 0
                        };
                    }
                    catch (error) {
                        console.warn(`Error getting note ${note.path}:`, error instanceof Error ? error.message : 'Unknown error');
                        return null;
                    }
                });
                const batchResults = await Promise.all(batchPromises);
                const validResults = batchResults.filter((note) => note !== null);
                notesWithContent.push(...validResults);
                if (notesWithContent.length >= 10) {
                    break;
                }
            }
            console.log(`Successfully retrieved content for ${notesWithContent.length} notes`);
            if (notesWithContent.length === 0) {
                return res.apiSuccess({
                    results: [],
                    reasoning: 'Could not retrieve content for any notes.',
                    total: 0,
                    searchType: 'none'
                });
            }
            const { results, reasoning } = await AIService.semanticSearch(query, notesWithContent, limit);
            return res.apiSuccess({
                results,
                reasoning,
                total: results.length,
                searchType: 'semantic'
            });
        }
        catch (error) {
            console.error('Error in semantic search handler:', error);
            return res.apiError(`Failed to perform search: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
        }
    }
    catch (error) {
        console.error('Unexpected error in semantic search handler:', error);
        next(error);
    }
};
const summarizeHandler = async (req, res, next) => {
    try {
        const { content } = req.body;
        if (!content) {
            res.apiError('Content is required', 400);
            return;
        }
        const summary = await AIService.summarizeNote(content);
        res.apiSuccess({ summary });
    }
    catch (error) {
        console.error('Error summarizing note:', error);
        next(error);
    }
};
const askHandler = async (req, res, next) => {
    try {
        const { question, notePath } = req.body;
        if (!question) {
            res.apiError('Question is required', 400);
            return;
        }
        console.log(`Processing question: "${question}"`);
        let context = '';
        if (notePath) {
            console.log(`Using specific note: ${notePath}`);
            try {
                const note = await api.getNote(notePath);
                context = `Note content from ${path.basename(notePath)}:\n${note.content}`;
                console.log(`Fetched note content (${note.content.length} chars)`);
            }
            catch (error) {
                console.error('Error fetching note:', error);
                context = `I couldn't access the note at ${notePath}. It may have been moved or deleted.`;
            }
        }
        else {
            console.log('Searching for relevant notes...');
            try {
                const searchResults = await api.searchNotes(question, 5);
                console.log(`Found ${searchResults.length} relevant notes`);
                if (searchResults.length > 0) {
                    context = searchResults.map((r, index) => `[${index + 1}] Note: ${r.path}\n` +
                        `Last Modified: ${new Date(r.lastModified).toLocaleString()}\n` +
                        `Content:\n${r.content.substring(0, 1000)}${r.content.length > 1000 ? '...' : ''}`).join('\n\n');
                    console.log(`Created context with ${searchResults.length} notes`);
                }
                else {
                    context = 'No relevant notes found. You can ask me general questions, but I might not have specific information from your notes.';
                    console.log('No relevant notes found for context');
                }
            }
            catch (error) {
                console.error('Error searching notes:', error);
                context = 'I had trouble searching through your notes. You can still ask me general questions.';
            }
        }
        console.log('Generated context length:', context.length);
        try {
            const answer = await AIService.answerQuestion(question, context);
            res.apiSuccess({
                answer,
                context: notePath ? undefined : context
            });
        }
        catch (error) {
            console.error('Error generating answer:', error);
            res.apiError('Failed to generate an answer. Please try again later.');
        }
    }
    catch (error) {
        console.error('Error in askHandler:', error);
        next(error);
    }
};
router.post('/semantic-search', semanticSearchHandler);
router.post('/summarize', summarizeHandler);
router.post('/ask', askHandler);
export default router;
//# sourceMappingURL=ai.js.map