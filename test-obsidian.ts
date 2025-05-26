import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Import the Obsidian tool instance
import obsidian from './src/tools/obsidian';

async function testObsidianTool() {
  try {
    
    // Test listNotes
    console.log('Testing listNotes...');
    const listResult = await obsidian.listNotes('', 5);
    console.log('List notes result:', JSON.stringify(listResult, null, 2));
    
    if (listResult.files.length > 0) {
      // Test readNote with the first file
      const firstFile = listResult.files[0];
      console.log(`\nTesting readNote with file: ${firstFile.path}`);
      const readResult = await obsidian.readNote(path.join(process.env.OBSIDIAN_VAULT_PATH || '', firstFile.path));
      console.log('Read note result (first 200 chars):', readResult.content.substring(0, 200) + '...');
      
      // Test searchNotes with a sample query
      console.log('\nTesting searchNotes with query: "note"');
      const searchResult = await obsidian.searchNotes('note', 3);
      console.log('Search results:', JSON.stringify(searchResult, null, 2));
    }
    
    console.log('\nAll tests completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

testObsidianTool();
