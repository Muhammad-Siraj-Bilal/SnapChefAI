"""
SnapChef AI — FastAPI Backend
Main application entry point with all routes and middleware.
"""

import os
import uuid
import logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

# RENDER STABILITY PATCH: ChromaDB requires a newer sqlite3 version than what's often on Render/Railway.
try:
    import pysqlite3
    import sys
    sys.modules["sqlite3"] = pysqlite3
except ImportError:
    pass

from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from langsmith import traceable

from models.schemas import (
    ChatRequest,
    ChatResponse,
    RecipeResponse,
    WeatherRequest,
    WeatherSuggestion,
    HealthResponse,
    GuardrailStats,
    UserPreferences,
    VisionOutput,
)
from utils.image_utils import validate_image_bytes, compress_image, encode_image_base64
from chains.vision_chain import identify_image
from chains.recipe_chain import generate_recipe

from tools.weather_tool import get_weather_suggestion
from guardrails.guardrails import (
    is_uncertain,
    build_uncertainty_message,
    check_non_food,
    get_confidence_label,
    check_unsafe_request,
    check_prompt_injection,
    sanitize_input,
)
from guardrails.guardrail_counter import counter, GuardrailEvent
from guardrails.rate_limiter import rate_limiter
from memory.session_memory import (
    update_session_recipe,
    get_session_recipe,
    get_active_session_count,
)

# ─────────────────────────────────────────────
# Logging Setup
# ─────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# Lifespan: Pre-warm the RAG knowledge base on startup
# ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("SnapChef AI starting up...")
    
    # ── Background Pre-warm (Threaded) ──
    # We use to_thread because model loading is CPU-bound and would otherwise
    # block the event loop, preventing the server from binding to the port.
    import asyncio
    def _do_pre_warm():
        try:
            from rag.knowledge_base import get_vector_store
            get_vector_store()
            logger.info("SnapChef AI: RAG knowledge base pre-warmed in background thread.")
        except Exception as e:
            logger.warning(f"Threaded pre-warm failed: {e}")

    asyncio.create_task(asyncio.to_thread(_do_pre_warm))
    
    yield
    logger.info("SnapChef AI shutting down.")


# ─────────────────────────────────────────────
# App Initialization
# ─────────────────────────────────────────────
app = FastAPI(
    title="SnapChef AI",
    description="Multimodal AI cooking assistant — image to recipe with conversational follow-ups",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow the Vercel frontend and local dev
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# LangSmith tracing middleware (ASGI)
try:
    from langsmith.middleware import TracingMiddleware
    app.add_middleware(TracingMiddleware)
    logger.info("LangSmith TracingMiddleware enabled.")
except ImportError:
    logger.warning("LangSmith TracingMiddleware not available.")


# ─────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────

@app.get("/", include_in_schema=False)
async def root():
    """Redirect root to API documentation."""
    return RedirectResponse(url="/docs")


@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    """Health check endpoint for Railway deployment monitoring."""
    return HealthResponse(
        status="ok",
        service="SnapChef AI Backend",
        version="1.0.0",
    )


@app.get("/stats", tags=["System"])
async def get_stats():
    """Returns system stats including real-time guardrail counters."""
    guardrail_data = counter.get_stats() # Global view
    return {
        "active_sessions": get_active_session_count(),
        "langsmith_enabled": bool(os.getenv("LANGSMITH_API_KEY")),
        "tavily_enabled": bool(os.getenv("TAVILY_API_KEY")),
        "weather_enabled": bool(os.getenv("OPENWEATHERMAP_API_KEY")),
        "rag_enabled": True,
        "guardrail_stats": GuardrailStats(**guardrail_data),
    }


@app.post("/analyze", response_model=RecipeResponse, tags=["Core"])
@traceable(name="analyze_image_endpoint")
async def analyze_image(
    image: Optional[UploadFile] = File(None),
    text_query: Optional[str] = Form(default=None, description="Direct text request"),
    session_id: str = Form(default=""),
    preferences_json: str = Form(default="{}"),
):
    """
    Analyzes an uploaded food image and generates a complete recipe.

    Flow:
    1. Rate limit check
    2. Prompt injection check on preferences_json
    3. Validate & compress image
    4. Vision chain: identify dish/ingredients
    5. Guardrails: check if food, check confidence
    6. Recipe chain: generate full structured recipe
    7. Save to session memory
    8. Return RecipeResponse
    """
    # ── Generate or use session ID ──
    if not session_id or session_id.strip() == "":
        session_id = str(uuid.uuid4())

    # ── Rate limit ──
    counter.tick(session_id=session_id)
    allowed, rate_msg = rate_limiter.is_allowed(session_id, "analyze")
    if not allowed:
        counter.increment(GuardrailEvent.RATE_LIMITED, session_id=session_id, endpoint="analyze")
        raise HTTPException(status_code=429, detail=rate_msg)

    # ── Parse & sanitize preferences ──
    try:
        import json
        prefs_raw = sanitize_input(preferences_json) if preferences_json else "{}"

        # Prompt injection check on free-text fields in preferences JSON
        injection_check = check_prompt_injection(prefs_raw)
        if injection_check.is_injection:
            event = (
                GuardrailEvent.JAILBREAK_ATTEMPT
                if injection_check.threat_type == "jailbreak"
                else GuardrailEvent.PROMPT_INJECTION
            )
            counter.increment(event, session_id=session_id, endpoint="analyze")
            raise HTTPException(
                status_code=400,
                detail="Preferences contain invalid or unsafe content."
            )

        prefs_data = json.loads(prefs_raw) if prefs_raw else {}
        preferences = UserPreferences(**prefs_data)
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Failed to parse preferences: {e}. Using defaults.")
        preferences = UserPreferences()

    # ── Text query guardrails ──
    if text_query:
        clean_text = sanitize_input(text_query)
        injection_check = check_prompt_injection(clean_text)
        if injection_check.is_injection:
            event = (
                GuardrailEvent.JAILBREAK_ATTEMPT
                if injection_check.threat_type == "jailbreak"
                else GuardrailEvent.PROMPT_INJECTION
            )
            counter.increment(event, session_id=session_id, endpoint="analyze")
            raise HTTPException(status_code=400, detail="Text query contains invalid or unsafe content.")
            
        is_unsafe, unsafe_reason = check_unsafe_request(clean_text)
        if is_unsafe:
            counter.increment(GuardrailEvent.UNSAFE_CONTENT, session_id=session_id, endpoint="analyze")
            raise HTTPException(status_code=400, detail=unsafe_reason)
        # Update text query with sanitized version
        text_query = clean_text

    # ── Verify at least one input provided ──
    if (not image or not image.filename) and not text_query:
        raise HTTPException(status_code=400, detail="Must provide either an image or a text query.")

    # ── Image processing or Text mocking ──
    if image and image.filename:
        # Read and validate image
        image_bytes = await image.read()
        content_type = image.content_type or "image/jpeg"

        is_valid, error_msg = validate_image_bytes(image_bytes, content_type)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)

        # Compress image
        compressed_bytes = compress_image(image_bytes, content_type)
        image_data_url = encode_image_base64(compressed_bytes)

        # Vision identification
        logger.info(f"Session {session_id}: Analyzing image...")
        vision_output = identify_image(image_data_url)
    elif text_query:
        # No valid image, just text query
        logger.info(f"Session {session_id}: Processing text query '{text_query}'...")
        vision_output = VisionOutput(
            is_food=True,
            confidence=1.0,
            dish_name=text_query,
            detected_ingredients=[]
        )
    else:
        raise HTTPException(status_code=400, detail="Must provide either an image or a text query.")

    # ── Non-food guardrail ──
    is_blocked, block_reason = check_non_food(vision_output.is_food)
    if is_blocked:
        counter.increment(GuardrailEvent.NON_FOOD, session_id=session_id, endpoint="analyze")
        raise HTTPException(status_code=422, detail=block_reason)

    # ── Low confidence guardrail ──
    if is_uncertain(vision_output.confidence):
        counter.increment(GuardrailEvent.LOW_CONFIDENCE, session_id=session_id, endpoint="analyze")
        uncertainty_msg = build_uncertainty_message(vision_output)
        return RecipeResponse(
            dish_name=vision_output.dish_name,
            confidence=vision_output.confidence,
            confidence_label=get_confidence_label(vision_output.confidence),
            is_uncertain=True,
            uncertainty_message=uncertainty_msg,
            detected_ingredients=vision_output.detected_ingredients,
            session_id=session_id,
        )

    # ── Full recipe generation ──
    logger.info(f"Session {session_id}: Generating recipe for '{vision_output.dish_name}'...")
    recipe_response = generate_recipe(vision_output, preferences, session_id)
    recipe_response.session_id = session_id

    # ── Flag allergen warnings ──
    if recipe_response.allergy_warnings:
        for _ in recipe_response.allergy_warnings:
            counter.increment(GuardrailEvent.ALLERGEN_WARNING, session_id=session_id, endpoint="analyze")

    # ── Save to session ──
    update_session_recipe(session_id, recipe_response)

    logger.info(f"Session {session_id}: Recipe generated successfully.")
    return recipe_response


@app.post("/chat", response_model=ChatResponse, tags=["Core"])
@traceable(name="chat_endpoint")
async def chat(
    message: str = Form(...),
    session_id: str = Form(...),
    preferences_json: str = Form(default="{}"),
    image: Optional[UploadFile] = File(None),
):
    """
    Handles conversational follow-up messages with optional visual context.
    Maintains memory of previous exchanges and the current recipe.

    Flow:
    1. Rate limit check
    2. Sanitize + injection guard on message
    3. Unsafe keyword check
    4. Pass to chat chain (which does RAG + LLM)
    """
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required.")

    # ── Rate limit ──
    counter.tick(session_id=session_id)
    allowed, rate_msg = rate_limiter.is_allowed(session_id, "chat")
    if not allowed:
        counter.increment(GuardrailEvent.RATE_LIMITED, session_id=session_id, endpoint="chat")
        raise HTTPException(status_code=429, detail=rate_msg)

    # ── Parse preferences ──
    try:
        preferences = UserPreferences.model_validate_json(preferences_json)
    except Exception as e:
        logger.warning(f"Failed to parse preferences: {e}. Using defaults.")
        preferences = UserPreferences()

    # ── Image processing ──
    vision_context = ""
    if image and image.filename:
        image_bytes = await image.read()
        content_type = image.content_type or "image/jpeg"

        is_valid, error_msg = validate_image_bytes(image_bytes, content_type)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)

        # Compress and encode
        compressed_bytes = compress_image(image_bytes, content_type)
        image_data_url = encode_image_base64(compressed_bytes)

        # Vision identification
        logger.info(f"Session {session_id}: Analyzing chat image...")
        vision_output = identify_image(image_data_url)
        
        ingredients_str = ", ".join(vision_output.detected_ingredients) if vision_output.detected_ingredients else "none specifically identified"
        vision_context = f"[System Note: User attached an image showing {vision_output.dish_name}. Detected ingredients: {ingredients_str}.]\n\n"

    # ── Sanitize message ──
    clean_message = sanitize_input(message)
    if not clean_message and not vision_context:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
        
    full_message = vision_context + clean_message

    # ── Prompt injection guard ──
    injection = check_prompt_injection(clean_message)
    if injection.is_injection:
        event = (
            GuardrailEvent.JAILBREAK_ATTEMPT
            if injection.threat_type == "jailbreak"
            else GuardrailEvent.PROMPT_INJECTION
        )
        counter.increment(event, session_id=session_id, endpoint="chat")
        logger.warning(
            f"[INJECTION] session={session_id} "
            f"type={injection.threat_type} pattern='{injection.matched_pattern}'"
        )
        return ChatResponse(
            session_id=session_id,
            reply=injection.safe_reply,
            action_taken="blocked_injection",
            guardrail_stats=counter.get_stats(session_id=session_id),
        )

    # ── Unsafe keyword guard ──
    is_unsafe, unsafe_reason = check_unsafe_request(clean_message)
    if is_unsafe:
        counter.increment(GuardrailEvent.UNSAFE_CONTENT, session_id=session_id, endpoint="chat")
        return ChatResponse(
            session_id=session_id,
            reply=unsafe_reason,
            action_taken="blocked_unsafe",
            guardrail_stats=counter.get_stats(session_id=session_id),
        )

    # ── Final Processing ──
    from chains.chat_chain import process_cooking_chat_v5 
    
    print(f"DEBUG: Processing message: {full_message[:50]}")
    result = await process_cooking_chat_v5(
        session_id=session_id,
        message=full_message,
        preferences=preferences,
    )
    print(f"DEBUG: Result Action: {result.get('action_taken')}")

    # Track if chat logic blocked internally
    if result.get("action_taken") == "blocked":
        counter.increment(GuardrailEvent.UNSAFE_CONTENT, session_id=session_id, endpoint="chat")

    stats = counter.get_stats(session_id=session_id)
    logger.info(f"DEBUG: Guardrail Stats: {stats}")

    return ChatResponse(
        session_id=session_id,
        reply=result["reply"],
        updated_recipe=result.get("updated_recipe"),
        action_taken=result.get("action_taken", "chat"),
        requires_confirmation=result.get("requires_confirmation", False),
        suggested_actions=result.get("suggested_actions", []),
        guardrail_stats=stats
    )


@app.post("/weather", response_model=WeatherSuggestion, tags=["Optional"])
async def weather_suggest(request: WeatherRequest):
    """
    Returns weather-based cooking suggestions for the given city.
    Falls back gracefully if OpenWeatherMap API is not configured.
    """
    return await get_weather_suggestion(request.city)


@app.get("/session/{session_id}/recipe", response_model=RecipeResponse, tags=["Session"])
async def get_current_recipe(session_id: str):
    """Returns the current recipe stored in a session."""
    recipe = get_session_recipe(session_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="No recipe found for this session.")
    return recipe
