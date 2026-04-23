"""
SnapChef AI — Tavily Search Tool
Provides live web search for ingredient substitutions, cooking tips, and regional dish info.
"""

import os
import logging
from langsmith import traceable

logger = logging.getLogger(__name__)

TAVILY_AVAILABLE = False
TavilySearch = None

try:
    from langchain_tavily import TavilySearch as _TavilySearch
    TavilySearch = _TavilySearch
    TAVILY_AVAILABLE = bool(os.getenv("TAVILY_API_KEY"))
    if TAVILY_AVAILABLE:
        logger.info("Tavily search tool initialized.")
    else:
        logger.warning("TAVILY_API_KEY not set — Tavily search disabled.")
except ImportError:
    logger.warning("langchain-tavily not installed — Tavily search disabled.")


def _get_tavily_tool():
    if not TAVILY_AVAILABLE or TavilySearch is None:
        return None
    return TavilySearch(max_results=5, search_depth="advanced")


@traceable(name="tavily_search")
def search_cooking_info(query: str) -> str:
    """
    Searches the web for cooking-related information using Tavily.
    Falls back to empty string if Tavily is unavailable.
    
    Use cases:
    - Ingredient substitutions
    - Regional dish background
    - Allergen replacements
    - Low-confidence dish verification
    - External cooking tips
    """
    tool = _get_tavily_tool()
    if tool is None:
        logger.info("Tavily unavailable — skipping web search.")
        return ""

    try:
        logger.info(f"Tavily search: '{query}'")
        results = tool.invoke({"query": query})

        if isinstance(results, list):
            # Format results as readable text
            formatted = []
            for r in results[:3]:
                if isinstance(r, dict):
                    title = r.get("title", "")
                    content = r.get("content", "")
                    if content:
                        formatted.append(f"**{title}**: {content[:300]}")
            return "\n\n".join(formatted)
        elif isinstance(results, str):
            return results[:1000]
        return ""

    except Exception as e:
        logger.error(f"Tavily search failed: {e}")
        return ""


@traceable(name="tavily_ingredient_substitution")
def find_ingredient_substitution(ingredient: str, restriction: str) -> str:
    """
    Searches for specific ingredient substitutions based on dietary restriction.
    E.g., find_ingredient_substitution("butter", "dairy_free")
    """
    query = f"best {restriction.replace('_', ' ')} substitute for {ingredient} in cooking"
    return search_cooking_info(query)


@traceable(name="tavily_verify_dish")
def verify_dish_identity(dish_description: str) -> str:
    """
    When vision confidence is medium, searches for more info about the dish.
    """
    query = f"What is {dish_description}? Ingredients and cooking method"
    return search_cooking_info(query)
