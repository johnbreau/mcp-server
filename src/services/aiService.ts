import OpenAI from 'openai';
import { SearchResult } from '../types/obsidian';

// Log environment variables for debugging
console.log('Environment variables in aiService:');
console.log('- OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '*** (exists)' : 'NOT FOUND');
console.log('- NODE_ENV:', process.env.NODE_ENV);

if (!process.env.OPENAI_API_KEY) {
  console.error('ERROR: OPENAI_API_KEY is not set in environment variables');
  process.exit(1);
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class AIService {
  static async semanticSearch(
    query: string, 
    notes: SearchResult[], 
    limit: number = 5
  ): Promise<{results: SearchResult[], reasoning: string}> {
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
    console.log('First 100 chars of prompt:', prompt.substring(0, 100) + '...');
    
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          { role: "system", content: "You are a helpful assistant that analyzes and retrieves relevant information. Always respond with valid JSON." },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }  // This ensures the response is valid JSON
      });

      const content = completion.choices[0]?.message?.content || '{}';
      console.log('Raw content from OpenAI:', content);
      
      let result;
      try {
        result = JSON.parse(content);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error parsing JSON from OpenAI:', error);
        console.error('Content that failed to parse:', content);
        throw new Error(`Failed to parse response from OpenAI: ${errorMessage}. Content: ${content.substring(0, 200)}...`);
      }
      
      // Map the indices back to the original notes and apply the limit
      const relevantNotes = (result.results || [])
      .map((index: number) => notes[index])
      .filter((note: SearchResult | undefined): note is SearchResult => note !== undefined)
      .slice(0, limit);
    
    return {
      results: relevantNotes,
      reasoning: result.reasoning || 'No reasoning provided.'
    };
  } catch (error) {
    console.error('Error in semantic search:', error);
    throw new Error(`Error performing semantic search: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

  static async summarizeNote(content: string): Promise<string> {
    const prompt = `Summarize the following note concisely while preserving key information:
    
    ${content}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { role: "system", content: "You are a helpful assistant that creates concise summaries." },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 300,
    });

    return completion.choices[0]?.message?.content || 'Unable to generate summary';
  }

  static async answerQuestion(question: string, context: string): Promise<string> {
    const prompt = `Answer the following question based on the provided context. If the context doesn't contain enough information, say so.
    
    Question: ${question}
    
    Context:
    ${context}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { role: "system", content: "You are a helpful assistant that answers questions based on the provided context." },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
    });

    return completion.choices[0]?.message?.content || 'Unable to generate an answer';
  }
}
