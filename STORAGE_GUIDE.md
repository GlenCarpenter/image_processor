# Image Storage & Database Guide

## Overview

The application now stores processed images on the server instead of in browser storage, with a SQLite database to track all image processing jobs.

## Directory Structure

```
segment_markup/
├── outputs/              # Processed images stored here
├── image_jobs.db        # SQLite database tracking all jobs
└── backend/
    ├── database.py      # Database utilities
    └── scripts/
        └── db_manager.py  # Database management CLI
```

## Features

### Server-Side Image Storage

- All resized/processed images are saved to the `outputs/` directory
- Each output has a unique filename: `resized_{original}_{timestamp}_{uuid}.jpg`
- Images are served via `/api/images/output/{filename}` endpoint
- No more browser storage quota issues!

### SQLite Job Tracking

The database tracks:
- Job type (resize, crop, etc.)
- Original and output filenames
- Image dimensions and pixel counts
- Aspect ratio and quality settings
- Creation timestamp
- Custom metadata

### API Endpoints

#### Process Images
- `POST /api/images/resize` - Resize an image, returns job ID
- `POST /api/images/resize-info` - Preview resize info without processing

#### Retrieve Images & Jobs
- `GET /api/images/output/{filename}` - Serve a processed image
- `GET /api/images/job/{job_id}` - Get job metadata
- `GET /api/images/jobs?limit=50&job_type=resize` - List recent jobs

## Database Management

Use the `db_manager.py` script to manage the database:

```powershell
# View available commands
python backend/scripts/db_manager.py

# Initialize/recreate database
python backend/scripts/db_manager.py init

# List recent jobs
python backend/scripts/db_manager.py list
python backend/scripts/db_manager.py list 50  # List 50 most recent

# Check database status
python backend/scripts/db_manager.py status

# Clear all job records (keeps database structure)
python backend/scripts/db_manager.py clear

# Completely destroy database file
python backend/scripts/db_manager.py destroy
```

## Clearing Old Data

### Clear Output Images

```powershell
# Delete all output images
Remove-Item outputs\* -Force

# Or delete specific files
Remove-Item outputs\resized_*.jpg -Force
```

### Clear Database

```powershell
# Clear job records but keep database
python backend/scripts/db_manager.py clear

# Or completely remove database file
python backend/scripts/db_manager.py destroy
```

## Benefits

1. **No Storage Limits** - Server storage instead of browser localStorage
2. **Persistent History** - Track all image processing jobs
3. **Easy Management** - Simple CLI tools for database operations
4. **Flexible** - Database can be easily recreated or destroyed
5. **Queryable** - Filter jobs by type, date, etc.

## Database Schema

```sql
CREATE TABLE image_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_type TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    output_filename TEXT NOT NULL,
    output_path TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Original image info
    original_width INTEGER,
    original_height INTEGER,
    original_pixels INTEGER,
    
    -- Output image info
    output_width INTEGER,
    output_height INTEGER,
    output_pixels INTEGER,
    
    -- Processing info
    aspect_ratio TEXT,
    quality INTEGER,
    target_pixels INTEGER,
    
    -- Additional metadata (JSON)
    metadata TEXT
);
```

## Development Notes

- Database is automatically initialized on first backend import
- The `outputs/` directory is auto-created if missing
- Both `outputs/` and `*.db` files are gitignored
- Images are served with proper `image/jpeg` content type
- Path traversal protection prevents accessing files outside outputs directory
