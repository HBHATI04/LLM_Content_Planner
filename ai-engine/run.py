import sys
import os
from pathlib import Path

# Add both root and api/ to sys.path
ROOT = Path(__file__).parent
for p in [str(ROOT), str(ROOT / "api")]:
    if p not in sys.path:
        sys.path.insert(0, p)

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "api.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=[str(ROOT)],
        timeout_graceful_shutdown=5,  # give 5s for in-flight requests on Ctrl+C
    )