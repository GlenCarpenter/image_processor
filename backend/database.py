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

        # Create image_outputs table - stores ALL processed images
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS image_outputs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL,
                file_path TEXT,
                operation_type TEXT NOT NULL,
                original_filename TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                -- Image dimensions
                width INTEGER,
                height INTEGER,
                pixels INTEGER,
                original_width INTEGER,
                original_height INTEGER,
                original_pixels INTEGER,
                
                -- Processing metadata
                aspect_ratio TEXT,
                quality INTEGER,
                target_pixels INTEGER,
                metadata TEXT
            )
        """
        )

        # Create image_jobs table - tracks async Fal jobs only
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS image_jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                output_id INTEGER,
                job_type TEXT NOT NULL,
                input_filename TEXT NOT NULL,
                fal_request_id TEXT,
                job_status TEXT DEFAULT 'pending',
                error_message TEXT,
                metadata TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                -- Output info (populated when job completes)
                output_filename TEXT,
                output_width INTEGER,
                output_height INTEGER,
                output_pixels INTEGER,
                
                FOREIGN KEY (output_id) REFERENCES image_outputs(id)
            )
        """
        )

        # Create indices for image_outputs
        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_outputs_created_at 
            ON image_outputs(created_at DESC)
        """
        )

        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_outputs_operation_type 
            ON image_outputs(operation_type)
        """
        )

        # Create indices for image_jobs
        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_jobs_fal_request_id 
            ON image_jobs(fal_request_id)
        """
        )

        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_jobs_status 
            ON image_jobs(job_status)
        """
        )

        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_jobs_created_at 
            ON image_jobs(created_at DESC)
        """
        )


def create_output(
    filename: str,
    operation_type: str,
    original_filename: str,
    file_path: Optional[str] = None,
    width: Optional[int] = None,
    height: Optional[int] = None,
    pixels: Optional[int] = None,
    original_width: Optional[int] = None,
    original_height: Optional[int] = None,
    original_pixels: Optional[int] = None,
    aspect_ratio: Optional[str] = None,
    quality: Optional[int] = None,
    target_pixels: Optional[int] = None,
    metadata: Optional[str] = None,
) -> int:
    """
    Create a new image output record (for all operations: resize, segment, upscale, edit)

    Returns:
        int: The ID of the created output
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO image_outputs (
                filename, file_path, operation_type, original_filename,
                width, height, pixels,
                original_width, original_height, original_pixels,
                aspect_ratio, quality, target_pixels, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
            (
                filename,
                file_path,
                operation_type,
                original_filename,
                width,
                height,
                pixels,
                original_width,
                original_height,
                original_pixels,
                aspect_ratio,
                quality,
                target_pixels,
                metadata,
            ),
        )
        return cursor.lastrowid


def create_job(
    job_type: str,
    input_filename: str,
    fal_request_id: Optional[str] = None,
    job_status: str = "pending",
    metadata: Optional[str] = None,
) -> int:
    """
    Create a new async job record (for upscale and edit operations only)

    Returns:
        int: The ID of the created job
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO image_jobs (
                job_type, input_filename, fal_request_id, job_status, metadata
            ) VALUES (?, ?, ?, ?, ?)
        """,
            (job_type, input_filename, fal_request_id, job_status, metadata),
        )
        return cursor.lastrowid


def get_job(job_id: int) -> Optional[Dict[str, Any]]:
    """Get a specific job by ID"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM image_jobs WHERE id = ?", (job_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_output(output_id: int) -> Optional[Dict[str, Any]]:
    """Get a specific output by ID from image_outputs table"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM image_outputs WHERE id = ?", (output_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_recent_jobs(
    limit: int = 50, offset: int = 0, job_type: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Get recent outputs (for history page)
    Returns all image outputs regardless of how they were created

    Args:
        limit: Maximum number of outputs to return
        offset: Number of outputs to skip (for pagination)
        job_type: Optional operation type filter (e.g., 'resize', 'upscale')

    Returns:
        List of output dictionaries
    """
    with get_db() as conn:
        cursor = conn.cursor()
        if job_type:
            cursor.execute(
                """
                SELECT 
                    id, filename as output_filename, file_path as output_path,
                    operation_type as job_type, original_filename,
                    created_at, width as output_width, height as output_height,
                    pixels as output_pixels, original_width, original_height,
                    original_pixels, aspect_ratio, quality, target_pixels
                FROM image_outputs 
                WHERE operation_type = ?
                ORDER BY created_at DESC 
                LIMIT ? OFFSET ?
            """,
                (job_type, limit, offset),
            )
        else:
            cursor.execute(
                """
                SELECT 
                    id, filename as output_filename, file_path as output_path,
                    operation_type as job_type, original_filename,
                    created_at, width as output_width, height as output_height,
                    pixels as output_pixels, original_width, original_height,
                    original_pixels, aspect_ratio, quality, target_pixels
                FROM image_outputs 
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


def delete_output(output_id: int) -> bool:
    """
    Delete an output record from image_outputs table

    Returns:
        bool: True if output was deleted, False if not found
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM image_outputs WHERE id = ?", (output_id,))
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
    output_width: Optional[int] = None,
    output_height: Optional[int] = None,
    output_pixels: Optional[int] = None,
    output_id: Optional[int] = None,
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

        if output_width is not None:
            updates.append("output_width = ?")
            params.append(output_width)

        if output_height is not None:
            updates.append("output_height = ?")
            params.append(output_height)

        if output_pixels is not None:
            updates.append("output_pixels = ?")
            params.append(output_pixels)

        if output_id is not None:
            updates.append("output_id = ?")
            params.append(output_id)

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
        cursor.execute(
            "SELECT * FROM image_jobs WHERE fal_request_id = ?", (request_id,)
        )
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


def get_all_jobs(
    limit: int = 50, offset: int = 0, job_type: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Get all async jobs (for jobs page)
    Returns all jobs from image_jobs table

    Args:
        limit: Maximum number of jobs to return
        offset: Number of jobs to skip (for pagination)
        job_type: Optional job type filter (e.g., 'upscale', 'edit')

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


def destroy_db():
    """Completely remove the database file"""
    if DB_PATH.exists():
        DB_PATH.unlink()
        return True
    return False


# Initialize database on module import
init_db()
