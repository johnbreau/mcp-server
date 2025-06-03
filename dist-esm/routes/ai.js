import { Router } from 'express';
import path from 'path';
import { AIService } from '../services/aiService.js';
import { api } from '../api/obsidian.js';
const router = Router();
router.use((_req, res, next) => {
    res.apiSuccess = function (data, statusCode = 200) {
        const response = { success: true, data };
        return this.status(statusCode).json(response);
    };
    res.apiError = function (message, statusCode = 500) {
        const response = { success: false, error: message };
        return this.status(statusCode).json(response);
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
        if (!query) {
            res.apiError('Query is required', 400);
            return;
        }
        console.log('Starting semantic search for query:', query);
        const allNotes = await api.listNotes('', 100);
        console.log(`Found ${allNotes.length} notes in vault`);
        if (allNotes.length === 0) {
            console.error('No notes found in the vault');
            res.apiSuccess({
                results: [],
                reasoning: 'No notes found in the vault.',
                total: 0
            });
            return;
        }
        const notesToProcess = allNotes.slice(0, 10);
        console.log(`Processing ${notesToProcess.length} notes`);
        const notesWithContent = [];
        for (const note of notesToProcess) {
            try {
                const content = await api.getNote(note.path);
                notesWithContent.push({
                    path: note.path,
                    content: content.content,
                    lastModified: note.lastModified || new Date().toISOString(),
                    size: note.size || 0
                });
            }
            catch (error) {
                console.error(`Error getting note ${note.path}:`, error);
            }
        }
        console.log(`Successfully retrieved content for ${notesWithContent.length} notes`);
        if (notesWithContent.length === 0) {
            res.apiSuccess({
                results: [],
                reasoning: 'Could not retrieve content for any notes.',
                total: 0
            });
            return;
        }
        const { results, reasoning } = await AIService.semanticSearch(query, notesWithContent, limit);
        res.apiSuccess({
            results,
            reasoning,
            total: results.length
        });
    }
    catch (error) {
        console.error('Error in semantic search handler:', error);
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