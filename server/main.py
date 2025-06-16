from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pathlib import Path
import os
from typing import List, Optional, Union
from pydantic import BaseModel, Field
from enum import Enum

app = FastAPI(title="Apple Health Data Server")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Base directory for Apple Health data
BASE_DIR = Path(__file__).parent.parent / "appleHealthData"

class ItemType(str, Enum):
    FILE = "file"
    DIRECTORY = "directory"

class HealthDataItem(BaseModel):
    name: str
    path: str
    type: ItemType
    size: Optional[int] = Field(default=None, description="Size in bytes for files")

@app.get("/", response_model=List[HealthDataItem])
async def list_health_data():
    """List all available Apple Health data files and directories."""
    items = []
    
    if not BASE_DIR.exists():
        raise HTTPException(status_code=404, detail="Apple Health data directory not found")
    
    for item in BASE_DIR.glob("*"):
        items.append(HealthDataItem(
            name=item.name,
            path=str(item.relative_to(BASE_DIR.parent)),
            type=ItemType.DIRECTORY if item.is_dir() else ItemType.FILE,
            size=item.stat().st_size if item.is_file() else None
        ))
    
    return items

@app.get("/file/{file_path:path}")
async def get_file(file_path: str):
    """Get the contents of a specific file."""
    # Prevent directory traversal attacks
    full_path = (BASE_DIR / file_path).resolve()
    
    # Ensure the path is within the BASE_DIR
    if not str(full_path).startswith(str(BASE_DIR.resolve())):
        raise HTTPException(status_code=400, detail="Invalid file path")
    
    if not full_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    if full_path.is_dir():
        # Return directory listing
        contents = []
        for item in full_path.glob("*"):
            try:
                contents.append({
                    "name": item.name,
                    "path": str((Path(file_path) / item.name).as_posix()),
                    "type": ItemType.DIRECTORY if item.is_dir() else ItemType.FILE,
                    "size": item.stat().st_size if item.is_file() else None
                })
            except OSError:
                continue  # Skip files we can't access
        return {"type": "directory", "contents": contents}
    
    # For large files, return file metadata
    file_info = {
        "path": str(file_path),
        "size": full_path.stat().st_size,
        "type": full_path.suffix.lower().lstrip('.')
    }
    
    # For text files, include the content
    if full_path.suffix.lower() in ('.txt', '.json', '.xml'):
        try:
            file_info["content"] = full_path.read_text(encoding='utf-8', errors='replace')
        except UnicodeDecodeError:
            pass  # Skip content if not decodable as text
    
    return file_info

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
