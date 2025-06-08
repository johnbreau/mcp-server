import OpenAI from 'openai';
let openaiInstance = null;
function getOpenAIClient() {
    if (openaiInstance) {
        return openaiInstance;
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        const errorMsg = 'ERROR: OPENAI_API_KEY is not set in environment variables. Please set it in your .env file.';
        console.error(errorMsg);
        throw new Error(errorMsg);
    }
    try {
        console.log('Initializing OpenAI client with API key:', `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`);
        openaiInstance = new OpenAI({
            apiKey: apiKey,
        });
        console.log('OpenAI client initialized successfully');
        return openaiInstance;
    }
    catch (error) {
        const errorMsg = `Failed to initialize OpenAI client: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMsg);
        throw new Error(errorMsg);
    }
}
export class AIService {
    static async semanticSearch(query, notes, limit = 5) {
        if (!query || typeof query !== 'string') {
            throw new Error('Query must be a non-empty string');
        }
        if (!Array.isArray(notes)) {
            throw new Error('Notes must be an array');
        }
        if (notes.length === 0) {
            return { results: [], reasoning: 'No notes available to search.' };
        }
        const prompt = `You are a helpful assistant that helps find relevant notes based on semantic meaning.
Given the following notes and a query, return the most relevant notes in order of relevance.

Query: "${query}"

Notes:
${notes.map((note, i) => `[${i}] ${note.path}: ${note.content.substring(0, 200)}...`).join('\n')}

Return a JSON object with:
- reasoning: A brief explanation of why these notes are relevant
- results: An array of indices of the most relevant notes in order of relevance`;
        console.log('Sending prompt to OpenAI...');
        console.log('Prompt length:', prompt.length);
        try {
            const openai = getOpenAIClient();
            const completion = await openai.chat.completions.create({
                model: "gpt-4-turbo-preview",
                messages: [
                    {
                        role: "system",
                        content: "You are a helpful assistant that analyzes and retrieves relevant information. Always respond with valid JSON."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.3,
                response_format: { type: "json_object" }
            });
            const content = completion.choices[0]?.message?.content || '{}';
            console.log('Raw content from OpenAI:', content);
            let result;
            try {
                result = JSON.parse(content);
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.error('Error parsing JSON from OpenAI:', error);
                console.error('Content that failed to parse:', content);
                throw new Error(`Failed to parse response from OpenAI: ${errorMessage}. Content: ${content.substring(0, 200)}...`);
            }
            const relevantNotes = (result.results || [])
                .map((index) => notes[index])
                .filter((note) => note !== undefined)
                .slice(0, limit);
            return {
                results: relevantNotes,
                reasoning: result.reasoning || 'No reasoning provided.'
            };
        }
        catch (error) {
            console.error('Error in semantic search:', error);
            throw new Error(`Error performing semantic search: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    static async summarizeNote(content) {
        if (!content || typeof content !== 'string') {
            throw new Error('Content must be a non-empty string');
        }
        const prompt = `Please provide a concise summary of the following note content:\n\n${content}\n\nSummary:`;
        try {
            const openai = getOpenAIClient();
            const completion = await openai.chat.completions.create({
                model: "gpt-4-turbo-preview",
                messages: [
                    {
                        role: "system",
                        content: "You are a helpful assistant that summarizes notes concisely."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 200
            });
            return completion.choices[0]?.message?.content?.trim() || 'No summary available.';
        }
        catch (error) {
            console.error('Error in summarizeNote:', error);
            throw new Error(`Failed to generate summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    static async answerQuestion(question, context) {
        if (!question || typeof question !== 'string') {
            throw new Error('Question must be a non-empty string');
        }
        if (!context || typeof context !== 'string') {
            throw new Error('Context must be a non-empty string');
        }
        const prompt = `Based on the following context, please answer the question. If the context doesn't contain enough information, say so.\n\nContext: ${context}\n\nQuestion: ${question}\n\nAnswer:`;
        try {
            const openai = getOpenAIClient();
            const completion = await openai.chat.completions.create({
                model: "gpt-4-turbo-preview",
                messages: [
                    {
                        role: "system",
                        content: "You are a helpful assistant that answers questions based on the provided context. If the context doesn't contain enough information, say so."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 500
            });
            return completion.choices[0]?.message?.content?.trim() || 'I could not generate an answer.';
        }
        catch (error) {
            console.error('Error in answerQuestion:', error);
            throw new Error(`Failed to generate answer: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
//# sourceMappingURL=aiService.js.map