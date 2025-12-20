#!/usr/bin/env python3
"""
Database management utility
Commands for managing the image jobs database
"""
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.database import (
    init_db,
    get_recent_jobs,
    clear_all_jobs,
    destroy_db,
    DB_PATH,
)


def main():
    if len(sys.argv) < 2:
        print("Usage: python db_manager.py [command]")
        print("\nCommands:")
        print("  init     - Initialize/recreate the database")
        print("  list     - List recent jobs")
        print("  clear    - Clear all job records")
        print("  destroy  - Completely remove the database file")
        print("  status   - Show database status")
        return

    command = sys.argv[1].lower()

    if command == "init":
        init_db()
        print(f"✓ Database initialized at {DB_PATH}")

    elif command == "list":
        limit = int(sys.argv[2]) if len(sys.argv) > 2 else 20
        jobs = get_recent_jobs(limit=limit)

        if not jobs:
            print("No jobs found in database")
            return

        print(f"\n{len(jobs)} most recent jobs:")
        print("-" * 100)
        for job in jobs:
            print(
                f"ID: {job['id']} | Type: {job['job_type']} | "
                f"Created: {job['created_at']} | "
                f"File: {job['output_filename']}"
            )
            if job["output_width"] and job["output_height"]:
                print(
                    f"  Size: {job['output_width']}×{job['output_height']} | "
                    f"Aspect: {job['aspect_ratio']}"
                )
            print()

    elif command == "clear":
        count = clear_all_jobs()
        print(f"✓ Cleared {count} job records from database")

    elif command == "destroy":
        if destroy_db():
            print(f"✓ Database file deleted: {DB_PATH}")
        else:
            print(f"Database file not found: {DB_PATH}")

    elif command == "status":
        if DB_PATH.exists():
            size = DB_PATH.stat().st_size
            jobs = get_recent_jobs(limit=1)
            total_jobs = len(get_recent_jobs(limit=10000))
            print(f"Database: {DB_PATH}")
            print(f"Size: {size:,} bytes ({size/1024:.2f} KB)")
            print(f"Total jobs: {total_jobs}")
        else:
            print(f"Database does not exist: {DB_PATH}")

    else:
        print(f"Unknown command: {command}")
        print("Run without arguments to see available commands")


if __name__ == "__main__":
    main()
