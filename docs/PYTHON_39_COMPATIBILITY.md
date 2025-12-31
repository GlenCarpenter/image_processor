# Python 3.9 Compatibility Fix

## Issue
On macOS with Python 3.9, the application failed with:
```
TypeError: unsupported operand type(s) for |: 'type' and 'NoneType'
  File "backend/utils/image_processing.py", line 224
    def extract_prompt_from_metadata(img: Image.Image) -> str | None:
```

## Root Cause
Python 3.10 introduced the `|` union operator for type hints (e.g., `str | None`). Python 3.9 and earlier must use `Optional[str]` or `Union[str, None]` from the `typing` module.

## Solution Applied
✅ Updated [backend/utils/image_processing.py](backend/utils/image_processing.py):
- Added `Optional` to imports: `from typing import Dict, Any, Optional`
- Changed return type: `str | None` → `Optional[str]`

## Testing
```bash
# On macOS with Python 3.9+
source venv/bin/activate
python -m backend.main
# Should now run without TypeError
```

## Python Version Requirements
- **Minimum**: Python 3.9
- **Recommended**: Python 3.10+

The code now works with Python 3.9, but Python 3.10+ is still recommended for better performance and features.
