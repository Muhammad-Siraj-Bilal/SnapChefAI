"""
SnapChef AI — Vision Chain
Identifies dishes/ingredients from an uploaded image using Groq's vision model.
"""

import os
import json
import logging
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage
from langsmith import traceable

from models.schemas import VisionOutput

logger = logging.getLogger(__name__)

VISION_SYSTEM_PROMPT = """You are a professional culinary AI assistant with expert knowledge in food identification.
Your task is to analyze food images and identify dishes or ingredients accurately.
You must respond ONLY with valid JSON matching the specified schema — no markdown, no explanation outside JSON.
Be honest about uncertainty — never fake confidence."""

VISION_IDENTIFICATION_PROMPT = """Analyze this image carefully and identify what you see.

Respond with ONLY this JSON object (no markdown, no extra text):
{{
  "dish_name": "Name of the dish or primary ingredient set visible (use 'Assorted Ingredients' for fridge/pantry shots, 'Unknown' if cannot determine)",
  "confidence": <float between 0.0 and 1.0>,
  "detected_ingredients": ["ingredient1", "ingredient2", ...],
  "is_food": <true if image contains food/ingredients/meals, false otherwise>,
  "notes": "Any notes about what you're unsure about, or empty string"
}}

Confidence guide:
- 0.9+  : Very clear, easily identifiable dish
- 0.75-0.89: Recognizable but some ambiguity
- 0.50-0.74: Possibly identifiable, significant uncertainty
- 0.25-0.49: Very uncertain, multiple plausible interpretations
- 0.0-0.24: Cannot determine — image unclear or not food-related"""


def _get_vision_llm() -> ChatGroq:
    return ChatGroq(
        model=os.getenv("GROQ_VISION_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct"),
        temperature=0.1,
        max_tokens=1024,
    )


@traceable(name="identify_image")
def identify_image(image_data_url: str) -> VisionOutput:
    """
    Sends an image to Groq's vision model and returns structured identification output.
    
    Args:
        image_data_url: Base64-encoded image as a data URL (data:image/jpeg;base64,...)
    
    Returns:
        VisionOutput with dish_name, confidence, detected_ingredients, is_food, notes
    """
    llm = _get_vision_llm()

    message = HumanMessage(
        content=[
            {
                "type": "text",
                "text": VISION_SYSTEM_PROMPT + "\n\n" + VISION_IDENTIFICATION_PROMPT,
            },
            {
                "type": "image_url",
                "image_url": {"url": image_data_url},
            },
        ]
    )

    logger.info("Sending image to Groq vision model for identification...")
    response = llm.invoke([message])
    raw_text = response.content.strip()

    # Strip markdown code fences if present
    if raw_text.startswith("```"):
        lines = raw_text.split("\n")
        raw_text = "\n".join(lines[1:-1]) if lines[-1] == "```" else "\n".join(lines[1:])

    try:
        data = json.loads(raw_text)
        output = VisionOutput(**data)
        logger.info(
            f"Vision identified: '{output.dish_name}' "
            f"(confidence={output.confidence:.2f}, is_food={output.is_food})"
        )
        return output
    except (json.JSONDecodeError, Exception) as e:
        logger.error(f"Failed to parse vision output: {e}\nRaw: {raw_text}")
        # Return a low-confidence fallback
        return VisionOutput(
            dish_name="Unknown",
            confidence=0.1,
            detected_ingredients=[],
            is_food=True,  # Assume food to avoid blocking legitimate uploads
            notes=f"Could not parse model response: {str(e)[:100]}",
        )
