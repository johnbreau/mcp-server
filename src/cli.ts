#!/usr/bin/env node
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from project root first
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Now import other dependencies after environment is loaded
import { Command } from 'commander';
import chalk from 'chalk';
import obsidian from './tools/obsidian.js';

const program = new Command();

// Set up the CLI
program
  .name('obsidian-cli')
  .description('CLI for interacting with your Obsidian vault')
  .version('1.0.0');

// Helper function to handle errors
function handleError(error: unknown, context: string = ''): never {
  const errorMessage = error instanceof Error 
    ? error.message 
    : 'An unknown error occurred';
  
  console.error(chalk.red(`Error${context ? ` (${context})` : ''}:`), errorMessage);
  process.exit(1);
}

// Search command
program
  .command('search <query>')
  .description('Search for notes containing the query')
  .option('-l, --limit <number>', 'Maximum number of results', '5')
  .action(async (query: string, options: { limit: string }) => {
    try {
      const limit = parseInt(options.limit, 10);
      console.log(chalk.blue(`\nSearching for "${query}" (max ${limit} results)...\n`));
      
      const { results } = await obsidian.searchNotes(query, limit);
      
      if (results.length === 0) {
        console.log(chalk.yellow('No results found.'));
        return;
      }
      
      results.forEach((note, index) => {
        const fileName = note.path.split('/').pop() || 'Untitled';
        console.log(chalk.green.bold(`${index + 1}. ${fileName}`));
        console.log(chalk.gray(`  Path: ${note.path}`));
        console.log(chalk.gray(`  Modified: ${new Date(note.lastModified).toLocaleString()}`));
        console.log(chalk.gray(`  Size: ${Math.ceil(note.size / 1024)} KB`));
        const preview = note.content.length > 100 ? note.content.substring(0, 100) + '...' : note.content;
        console.log(chalk.white(`  ${preview || 'No content available'}\n`));
      });
    } catch (error) {
      handleError(error, 'search');
    }
  });

// List command
program
  .command('list [directory]')
  .description('List notes in a directory')
  .option('-l, --limit <number>', 'Maximum number of results', '10')
  .action(async (directory: string = '', options: { limit: string }) => {
    try {
      const limit = parseInt(options.limit, 10);
      console.log(chalk.blue(`\nListing notes in "${directory || 'root'}" (max ${limit} results)...\n`));
      
      const result = await obsidian.listNotes(directory, limit);
      
      if (result.files.length === 0) {
        console.log(chalk.yellow('No files found in this directory.'));
        return;
      }
      
      console.log(chalk.blue(`Directory: ${result.path || '/'}`));
      console.log(chalk.blue(`Total files: ${result.total}\n`));
      
      result.files.forEach((file, index) => {
        console.log(chalk.green.bold(`${index + 1}. ${file.name}`));
        console.log(chalk.gray(`  Path: ${file.path}`));
        if (file.modified) {
          console.log(chalk.gray(`  Modified: ${new Date(file.modified).toLocaleString()}`));
        }
        console.log(chalk.gray(`  Size: ${Math.ceil(file.size / 1024)} KB\n`));
      });
    } catch (error) {
      handleError(error, 'list');
    }
  });

// Read command
program
  .command('read <filePath>')
  .description('Read the content of a specific note')
  .action(async (filePath: string) => {
    try {
      console.log(chalk.blue(`\nReading note: ${filePath}\n`));
      
      const fullPath = path.join(process.env.OBSIDIAN_VAULT_PATH || '', filePath);
      const note = await obsidian.readNote(fullPath);
      
      console.log(chalk.green.bold(note.title));
      console.log(chalk.gray(`Path: ${note.path}`));
      if (note.modified) {
        console.log(chalk.gray(`Modified: ${new Date(note.modified).toLocaleString()}`));
      }
      console.log(chalk.gray(`Size: ${Math.ceil(note.size / 1024)} KB\n`));
      console.log(chalk.white('--- CONTENT ---\n'));
      console.log(note.content);
      console.log(chalk.white('\n--- END OF CONTENT ---'));
    } catch (error) {
      handleError(error, 'read');
    }
  });

// Show help if no arguments
if (process.argv.length <= 2) {
  program.help();
}

// Parse command line arguments
program.parse(process.argv);
