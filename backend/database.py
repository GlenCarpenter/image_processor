"""
SQLite Database for tracking image processing jobs
Simple and easily recreatable database for tracking image operations
"""

import sqlite3
from pathlib import Path
from typing import Optional, List, Dict, Any
from contextlib import contextmanager


# Database file location
DB_PATH = Path(__file__).parent.parent / "image_jobs.db"


@contextmanager
def get_db():
    """Context manager for database connections"""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row  # Enable column access by name
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Initialize the database with required tables"""
    with get_db() as conn:
        cursor = conn.cursor()

        # Create image_jobs table
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS image_jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_type TEXT NOT NULL,
                original_filename TEXT NOT NULL,
                output_filename TEXT,
                output_path TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                -- Async job tracking
                fal_request_id TEXT,
                job_status TEXT DEFAULT 'pending',
                error_message TEXT,
                
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
                
                -- Additional metadata (JSON-serializable)
                metadata TEXT
            )
        """
        )

        # Create index on created_at for efficient queries
        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_created_at 
            ON image_jobs(created_at DESC)
        """
        )

        # Create index on job_type for filtering
        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_job_type 
            ON image_jobs(job_type)
        """
        )
        
        # Create index on fal_request_id for webhook lookups
        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_fal_request_id 
            ON image_jobs(fal_request_id)
        """
        )
        
        # Create index on job_status for filtering active jobs
        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_job_status 
            ON image_jobs(job_status)
        """
        )


def create_job(
    job_type: str,
    original_filename: str,
    output_filename: Optional[str] = None,
    output_path: Optional[str] = None,
    fal_request_id: Optional[str] = None,
    job_status: str = "pending",
    original_width: Optional[int] = None,
    original_height: Optional[int] = None,
    original_pixels: Optional[int] = None,
    output_width: Optional[int] = None,
    output_height: Optional[int] = None,
    output_pixels: Optional[int] = None,
    aspect_ratio: Optional[str] = None,
    quality: Optional[int] = None,
    target_pixels: Optional[int] = None,
    metadata: Optional[str] = None,
) -> int:
    """
    Create a new image job record

    Returns:
        int: The ID of the created job
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO image_jobs (
                job_type, original_filename, output_filename, output_path,
                fal_request_id, job_status,
                original_width, original_height, original_pixels,
                output_width, output_height, output_pixels,
                aspect_ratio, quality, target_pixels, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
            (
                job_type,
                original_filename,
                output_filename,
                output_path,
                fal_request_id,
                job_status,
                original_width,
                original_height,
                original_pixels,
                output_width,
                output_height,
                output_pixels,
                aspect_ratio,
                quality,
                target_pixels,
                metadata,
            ),
        )
        return cursor.lastrowid


def get_job(job_id: int) -> Optional[Dict[str, Any]]:
    """Get a specific job by ID"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM image_jobs WHERE id = ?", (job_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_recent_jobs(
    limit: int = 50, offset: int = 0, job_type: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Get recent jobs, optionally filtered by type

    Args:
        limit: Maximum number of jobs to return
        offset: Number of jobs to skip (for pagination)
        job_type: Optional job type filter (e.g., 'resize', 'crop')

    Returns:
        List of job dictionaries
    """
    with get_db() as conn:
        cursor = conn.cursor()
        if job_type:
            cursor.execute(
                """
                SELECT * FROM image_jobs 
                WHERE job_type = ?
                ORDER BY created_at DESC 
                LIMIT ? OFFSET ?
            """,
                (job_type, limit, offset),
            )
        else:
            cursor.execute(
                """
                SELECT * FROM image_jobs 
                ORDER BY created_at DESC 
                LIMIT ? OFFSET ?
            """,
                (limit, offset),
            )

        return [dict(row) for row in cursor.fetchall()]


def delete_job(job_id: int) -> bool:
    """
    Delete a job record

    Returns:
        bool: True if job was deleted, False if not found
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM image_jobs WHERE id = ?", (job_id,))
        return cursor.rowcount > 0


def clear_all_jobs() -> int:
    """
    Clear all job records from the database

    Returns:
        int: Number of jobs deleted
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM image_jobs")
        return cursor.rowcount


def update_job_status(
    job_id: int,
    job_status: str,
    output_filename: Optional[str] = None,
    output_path: Optional[str] = None,
    output_width: Optional[int] = None,
    output_height: Optional[int] = None,
    output_pixels: Optional[int] = None,
    error_message: Optional[str] = None,
) -> bool:
    """
    Update job status and optionally output information
    
    Returns:
        bool: True if job was updated, False if not found
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Build dynamic update query based on provided parameters
        updates = ["job_status = ?", "updated_at = CURRENT_TIMESTAMP"]
        params = [job_status]
        
        if output_filename is not None:
            updates.append("output_filename = ?")
            params.append(output_filename)
        
        if output_path is not None:
            updates.append("output_path = ?")
            params.append(output_path)
        
        if output_width is not None:
            updates.append("output_width = ?")
            params.append(output_width)
        
        if output_height is not None:
            updates.append("output_height = ?")
            params.append(output_height)
        
        if output_pixels is not None:
            updates.append("output_pixels = ?")
            params.append(output_pixels)
        
        if error_message is not None:
            updates.append("error_message = ?")
            params.append(error_message)
        
        params.append(job_id)
        
        query = f"UPDATE image_jobs SET {', '.join(updates)} WHERE id = ?"
        cursor.execute(query, params)
        return cursor.rowcount > 0


def get_job_by_request_id(request_id: str) -> Optional[Dict[str, Any]]:
    """Get a job by its Fal request ID"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM image_jobs WHERE fal_request_id = ?", (request_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_active_jobs() -> List[Dict[str, Any]]:
    """Get all jobs that are pending or processing"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT * FROM image_jobs 
            WHERE job_status IN ('pending', 'processing', 'queued')
            ORDER BY created_at DESC
            """
        )
        return [dict(row) for row in cursor.fetchall()]


def destroy_db():
    """Completely remove the database file"""
    if DB_PATH.exists():
        DB_PATH.unlink()
        return True
    return False


# Initialize database on module import
init_db()
