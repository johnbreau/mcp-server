# Typescript MCP Server with Obsidian Integration

A command-line interface for interacting with your Obsidian vault.

## Prerequisites

- Node.js 14.x or later
- npm or yarn
- An Obsidian vault

## Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file in the project root with your Obsidian vault path:
   ```
   OBSIDIAN_VAULT_PATH=/path/to/your/obsidian/vault
   ```


## Development

### Client Application

To start the backend:
```bash
npm run dev
```

To start the React frontend:

1. Navigate to the client directory:
   ```bash
   cd client
   ```

2. Install dependencies (if not already installed):
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:5173` by default.

### Apple Health Data Server

The application includes a server to serve Apple Health data. Follow these steps to set it up:

1. Ensure you have Python 3.8+ installed
2. Install the required Python packages:
   ```bash
   pip install -r requirements.txt
   ```
3. Start the server:
   ```bash
   python server/main.py
   ```

The server will start on `http://localhost:8000` by default.

#### API Endpoints

- `GET /` - List all files and directories in the appleHealthData directory
- `GET /file/{path}` - Get file contents or list directory contents
- `GET /docs` - Interactive API documentation (Swagger UI)
- `GET /redoc` - Alternative API documentation (ReDoc)

For more details, see [APPLE_HEALTH_SERVER.md](APPLE_HEALTH_SERVER.md).

### Available Scripts

This project includes several npm scripts to help with development and testing:

#### Start the Server Application
```bash
npm start
```
Starts the application using `ts-node`. The server will be available at `http://localhost:3000` by default (or the port specified in your environment variables).

#### Development Mode with Auto-Reload
```bash
npm run dev
```
Starts the application in development mode using `nodemon`, which automatically restarts the server when you make changes to any TypeScript file in the `src` directory.

#### Build the Project
```bash
npm run build
```
Compiles TypeScript files to JavaScript in the `dist` directory.

#### Run Tests
```bash
npm test
```
Runs the test suite (currently no tests are configured).

#### Run CLI Tool
```bash
# Run the CLI tool directly
npm run cli [command]

# Examples:
npm run cli list
npm run cli search "query"
npm run cli read "path/to/note.md"
```

### Environment Variables

The application uses the following environment variables:

- `OBSIDIAN_VAULT_PATH`: Path to your Obsidian vault (required)
- `PORT`: Port number for the server (default: 3000)

Create a `.env` file in the project root to set these variables:
```env
OBSIDIAN_VAULT_PATH=/path/to/your/obsidian/vault
PORT=3000
```

### Project Structure

- `src/` - Source code
  - `tools/` - MCP tool implementations
    - `obsidian.ts` - Obsidian vault integration
  - `index.ts` - Main application entry point
  - `router.ts` - API route definitions
  - `types.ts` - TypeScript type definitions
- `dist/` - Compiled JavaScript (created when running `npm run build`)
- `test-obsidian.ts` - Test script for Obsidian tool
- `src/cli.ts` - Command-line interface

## CLI Usage

### Getting Started

After setting up your environment, you can use the CLI tool to interact with your Obsidian vault. The tool provides three main commands: `search`, `list`, and `read`.

### Search for Notes

Search for notes containing specific text:

```bash
# Basic search
npm run cli search "search query"

# Limit the number of results (default: 5)
npm run cli search "search query" -- --limit 10

# Example: Search for notes about "project management"
npm run cli search "project management"
```

Example output:
```
Searching for "project management" (max 5 results)...

1. Project Management Best Practices
  Path: 01_Projects/Project Management Best Practices.md
  Modified: 5/25/2025, 2:30:45 PM
  Size: 12 KB
  Project management is the practice of...

2. Team Meeting Notes
  Path: 02_Meetings/Team Meeting Notes.md
  Modified: 5/26/2025, 10:15:22 AM
  Size: 8 KB
  Discussed project management tools and...
```

### List Notes in a Directory

List all notes in a specific directory:

```bash
# List notes in the root directory
npm run cli list

# List notes in a specific directory
npm run cli list "00_Slipbox"

# Limit the number of results (default: 10)
npm run cli list "00_Slipbox" -- --limit 5

# Example: List all notes in the "Projects" directory
npm run cli list "01_Projects"
```

Example output:
```
Listing notes in "01_Projects" (max 10 results)...

Directory: 01_Projects
Total files: 15

1. Project Alpha
  Path: 01_Projects/Project Alpha.md
  Modified: 5/20/2025, 3:45:12 PM
  Size: 5 KB

2. Project Beta
  Path: 01_Projects/Project Beta.md
  Modified: 5/22/2025, 9:15:33 AM
  Size: 3 KB
```

### Read a Specific Note

View the content of a specific note:

```bash
# Read a note by its path relative to your vault root
npm run cli read "00_Slipbox/MyNote.md"

# Example: Read a note from a subdirectory
npm run cli read "01_Projects/Project Alpha/Meeting Notes.md"
```

Example output:
```
Reading note: 00_Slipbox/MyNote.md

My Note Title
Path: 00_Slipbox/MyNote.md
Modified: 5/26/2025, 11:00:00 AM
Size: 2 KB

--- CONTENT ---

# My Note

This is the content of my note...

- List item 1
- List item 2
- List item 3

--- END OF CONTENT ---
```

### Global Installation (Optional)

For easier access, you can install the CLI globally:

```bash
# From the project directory
npm link

# Now you can use it from anywhere
obsidian-cli list
obsidian-cli search "query"
obsidian-cli read "path/to/note.md"
```

## API Endpoints

If you prefer to use the HTTP API directly:

### Search for notes
```bash
curl -X POST http://localhost:3000/api/tools/obsidian/search \
  -H "Content-Type: application/json" \
  -d '{"query": "project", "limit": 5}'
```

### List notes in a directory
```bash
curl -X POST http://localhost:3000/api/tools/obsidian/list \
  -H "Content-Type: application/json" \
  -d '{"directory": "00_Slipbox", "limit": 10}'
```

### Read a specific note
```bash
curl -X POST http://localhost:3000/api/tools/obsidian/read \
  -H "Content-Type: application/json" \
  -d '{"filePath": "00_Slipbox/SomeNote.md"}'
```
