# Apple Health Data Server

A FastAPI-based server that serves Apple Health data from the `appleHealthData` directory.

## Setup

1. Install the required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

2. Ensure your Apple Health data is in the `appleHealthData` directory at the root of the project.

## Running the Server

To start the server, run:

```bash
uvicorn server.main:app --reload
```

The server will start on `http://localhost:8000`

## API Endpoints

- `GET /`: List all available Apple Health data files and directories
- `GET /file/{path}`: Get the contents of a specific file or list directory contents

## Example Usage

1. List all health data:
   ```bash
   curl http://localhost:8000/
   ```

2. Get contents of a specific file:
   ```bash
   curl http://localhost:8000/file/export.xml
   ```

3. List contents of a directory:
   ```bash
   curl http://localhost:8000/file/healthkit
   ```

## Integration with MCP Server

This server is designed to be consumed by the MCP server application. The MCP server can make HTTP requests to this server's endpoints to retrieve the Apple Health data as needed.
