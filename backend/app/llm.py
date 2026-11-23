from __future__ import annotations

import re
import time

from .config import GROQ_API_KEY, GROQ_MODEL


class LLMGenerationError(RuntimeError):
    pass


def _fallback_answer_from_prompt(prompt: str) -> str:
    status_match = re.search(r"status=(?P<status>[a-z_]+)", prompt, flags=re.IGNORECASE)
    entity_match = re.search(r"entity_id=(?P<entity>[A-Z]+-\d+)", prompt, flags=re.IGNORECASE)

    if not status_match or not entity_match:
        return "I do not have enough evidence to answer confidently."

    status_text = status_match.group("status").replace("_", " ")
    entity_id = entity_match.group("entity")
    return f"{entity_id} is {status_text}."


def generate(prompt: str) -> str:
    if not GROQ_API_KEY:
        return _fallback_answer_from_prompt(prompt)

    try:
        from groq import Groq
    except ModuleNotFoundError:
        return _fallback_answer_from_prompt(prompt)

    client = Groq(api_key=GROQ_API_KEY)
    last_error: Exception | None = None

    for attempt in range(1, 3):
        try:
            completion = client.chat.completions.create(
                model=GROQ_MODEL,
                temperature=0,
                messages=[
                    {
                        "role": "system",
                        "content": "Answer only from the evidence. If evidence is insufficient, say so.",
                    },
                    {
                        "role": "user",
                        "content": prompt,
                    },
                ],
            )
            content = completion.choices[0].message.content
            if not content:
                raise LLMGenerationError("LLM returned an empty response")
            return content.strip()
        except LLMGenerationError:
            raise
        except Exception as exc:
            last_error = exc
            if attempt == 2:
                break
            time.sleep(0.5)

    raise LLMGenerationError("LLM generation unavailable due to Groq API failure") from last_error
