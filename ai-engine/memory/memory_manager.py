class MemoryManager:

    def format_history(self, history: list) -> str:
        """
        Converts a list of message dicts into a readable conversation string.

        Handles both:
          - {"role": "user" | "ai" | "assistant", "content": "..."}  (MongoDB format)
          - {"role": "user" | "assistant", "content": "..."}         (OpenAI format)
        """
        if not history:
            return "No prior conversation."

        formatted = ""

        for msg in history:
            role = msg.get("role", "unknown")
            content = msg.get("content", "")

            # Normalize role labels for readability
            if role == "ai":
                role_label = "Assistant"
            elif role == "user":
                role_label = "User"
            else:
                role_label = role.capitalize()

            formatted += f"{role_label}: {content}\n"

        return formatted.strip()