from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pathlib import Path
import os
from typing import List, Optional, Union, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum
from datetime import datetime, timedelta
import xml.etree.ElementTree as ET
import json

# Import the health data parser
from health_data_parser import HealthDataParser

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
BASE_DIR = Path(__file__).parent.parent.absolute() / "appleHealthData"
print(f"Looking for Apple Health data in: {BASE_DIR}")

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

@app.get("/api/health/debug/export-status")
async def debug_export_status():
    """Debug endpoint to check the status of the export file"""
    export_file = BASE_DIR / "export.xml"
    
    if not export_file.exists():
        return {
            "status": "error",
            "message": f"Export file not found at {export_file}",
            "files_in_directory": [f.name for f in BASE_DIR.glob("*")]
        }
    
    try:
        file_size = export_file.stat().st_size
        return {
            "status": "success",
            "file_path": str(export_file),
            "file_size_bytes": file_size,
            "file_size_mb": round(file_size / (1024 * 1024), 2),
            "last_modified": datetime.fromtimestamp(export_file.stat().st_mtime).isoformat()
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Error checking export file: {str(e)}"
        }

@app.get("/api/health/sleep")
async def get_sleep_data(days: int = 30):
    """
    Get sleep data for the specified number of days.
    
    Args:
        days: Number of days of data to return
        
    Returns:
        List of daily sleep data points
    """
    try:
        # Initialize the parser
        export_file = BASE_DIR / "export.xml"
        if not export_file.exists():
            return JSONResponse(
                status_code=404,
                content={"detail": f"Apple Health export.xml file not found at {export_file}"}
            )
            
        parser = HealthDataParser(export_file)
        
        # Get sleep data (this will need to be implemented in the parser)
        sleep_data = parser.get_sleep_data(days)
        
        return sleep_data
        
    except Exception as e:
        print(f"Error getting sleep data: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing sleep data: {str(e)}"
        )

# Initialize the health data parser
EXPORT_XML_PATH = BASE_DIR / "export.xml"
health_parser = HealthDataParser(EXPORT_XML_PATH)

@app.get("/api/activity")
async def get_activity_data(days: int = 7):
    """
    Get activity data for the specified number of days.
    
    Args:
        days: Number of days of data to return (default: 7)
        
    Returns:
        List of daily activity data points
    """
    try:
        if not EXPORT_XML_PATH.exists():
            raise HTTPException(status_code=404, detail="Health data export file not found")
            
        activity_data = health_parser.parse_activity_data(days)
        return JSONResponse(content=activity_data)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing activity data: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
