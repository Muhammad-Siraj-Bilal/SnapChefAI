"""
SnapChef AI — Weather Tool
Provides seasonal cooking suggestions based on current weather.
"""

import os
import logging
import httpx
from typing import Tuple
from langsmith import traceable
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage
from models.schemas import WeatherSuggestion

logger = logging.getLogger(__name__)

OPENWEATHER_BASE_URL = "https://api.openweathermap.org/data/2.5/weather"


@traceable(name="get_weather_suggestion")
async def get_weather_suggestion(city: str) -> WeatherSuggestion:
    """
    Fetches current weather for a city and returns a cooking mood suggestion.
    Falls back gracefully if API key not set or city not found.
    """
    api_key = os.getenv("OPENWEATHERMAP_API_KEY")

    fallback = WeatherSuggestion(
        city=city,
        temperature_c=25.0,
        condition="Clear",
        suggestion="Enjoy a balanced, seasonal meal today!",
        recipe_mood="balanced",
    )

    if not api_key:
        logger.warning("OPENWEATHERMAP_API_KEY not set — skipping weather lookup.")
        return fallback

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                OPENWEATHER_BASE_URL,
                params={
                    "q": city,
                    "appid": api_key,
                    "units": "metric",
                },
            )
            response.raise_for_status()
            data = response.json()

        temp_c = data["main"]["temp"]
        condition = data["weather"][0]["main"]  # e.g. "Clear", "Rain", "Snow"
        desc = data["weather"][0]["description"]

        suggestion, mood = await _build_suggestion_ai(temp_c, condition, city)

        logger.info(f"Weather for {city}: {temp_c:.1f}°C, {desc}")
        return WeatherSuggestion(
            city=city,
            temperature_c=round(temp_c, 1),
            condition=condition,
            suggestion=suggestion,
            recipe_mood=mood,
        )

    except httpx.HTTPStatusError as e:
        logger.warning(f"Weather API error for '{city}': {e.response.status_code}")
        return fallback
    except Exception as e:
        logger.warning(f"Weather lookup failed: {e}")
        return fallback


async def _build_suggestion_ai(temp_c: float, condition: str, city: str) -> Tuple[str, str]:
    """Uses AI to generate a culturally-aware cooking suggestion based on weather."""
    try:
        llm = ChatGroq(
            model="llama-3.1-8b-instant",
            temperature=0.7,
            max_tokens=60,
        )
        
        prompt = f"""The current weather in {city} is {temp_c:.1f}°C and {condition}. 
        Give a short, appetizing cooking recommendation (max 15 words) and a mood (one word: refreshing, light, balanced, hearty, or warming).
        The recommendation SHOULD be inspired by the local cuisine or specialties of this city/region and the current season.
        
        Format: Suggestion | Mood"""
        
        response = await llm.ainvoke([
            SystemMessage(content="You are a world-class chef and food culture expert."),
            HumanMessage(content=prompt)
        ])
        
        raw = response.content.strip()
        if "|" in raw:
            parts = [p.strip() for p in raw.split("|")]
            return (f"✨ {parts[0]}", parts[1].lower())
            
        return (f"✨ {raw}", "balanced")
        
    except Exception as e:
        logger.warning(f"AI weather suggestion failed, falling back: {e}")
        # Standard fallback logic
        if temp_c >= 25: return (f"☀️ It's warm in {city} ({temp_c:.0f}°C). Perfect for light, fresh meals!", "light")
        if temp_c >= 10: return (f"🌤️ Pleasant in {city} ({temp_c:.0f}°C). A balanced meal sounds great!", "balanced")
        return (f"❄️ It's cool in {city} ({temp_c:.0f}°C). Comforting, warming food recommended!", "warming")
