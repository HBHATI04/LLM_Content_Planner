import os
import base64
import requests
from pathlib import Path
from dotenv import load_dotenv
from crewai.tools import BaseTool

# Load .env by absolute path so it works regardless of working directory
_env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=_env_path, override=True)


class StabilityImageTool(BaseTool):
    name: str = "Generate Image"
    description: str = (
        "Generate marketing images, campaign posters, logos, banners, or product "
        "visuals from a text prompt."
    )

    def _run(self, prompt: str) -> str | None:
        api_key = os.getenv("STABILITY_API_KEY")

        if not api_key:
            print(f"[StabilityTool] CWD: {os.getcwd()}")
            print(f"[StabilityTool] Looking for .env at: {_env_path.resolve()}")
            print(f"[StabilityTool] .env exists: {_env_path.exists()}")
            print("[StabilityTool] ERROR: STABILITY_API_KEY not found — add it to AI-ENGINE/.env")
            return None

        try:
            url = "https://api.stability.ai/v2beta/stable-image/generate/core"

            headers = {
                "Authorization": f"Bearer {api_key}",
                "Accept": "application/json",
            }

            files = {
                "prompt": (None, prompt),
                "output_format": (None, "png"),
            }

            response = requests.post(url, headers=headers, files=files, timeout=60)
            response.raise_for_status()

            data = response.json()
            image_base64 = data.get("image")

            if not image_base64:
                print("[StabilityTool] ERROR: no image in API response")
                return None

            image_bytes = base64.b64decode(image_base64)

            os.makedirs("generated_images", exist_ok=True)

            import time
            # Use timestamp for filename — avoids prompt text pollution
            timestamp = int(time.time())
            file_path = f"generated_images/img_{timestamp}.png"

            with open(file_path, "wb") as f:
                f.write(image_bytes)

            print(f"[StabilityTool] Image saved: {file_path}")
            return file_path

        except requests.exceptions.Timeout:
            print("[StabilityTool] ERROR: request timed out")
            return None
        except requests.exceptions.RequestException as e:
            print(f"[StabilityTool] ERROR: {e}")
            return None
        except Exception as e:
            print(f"[StabilityTool] UNEXPECTED ERROR: {e}")
            return None