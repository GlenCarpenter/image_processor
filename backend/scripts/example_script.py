"""
Example Python Script
This is a sample script that can be executed via the API
"""

import sys
import json
import argparse


def main(params=None):
    """Main script function"""
    print("Example script executed successfully!")

    if params:
        print(f"Received parameters: {json.dumps(params, indent=2)}")
        # Process parameters here

    # Your script logic goes here
    result = {"message": "Script completed", "processed": True}

    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Example script")
    parser.add_argument("--params", type=str, help="JSON parameters")
    args = parser.parse_args()

    params = json.loads(args.params) if args.params else None
    sys.exit(main(params))
