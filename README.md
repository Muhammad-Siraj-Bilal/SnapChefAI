# SnapChef AI 👨‍🍳

> A deployed multimodal AI cooking assistant that turns food/ingredient images into personalized recipes, then continues as a chatbot adapting recipes based on allergies, budget, health goals, cuisine preference, and available ingredients.

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14 (App Router) → Vercel |
| **Backend** | FastAPI + Python → Railway |
| **LLM** | Groq (`meta-llama/llama-4-scout-17b-16e-instruct`) |
| **Orchestration** | LangChain (LCEL, memory, tools) |
| **Tracing** | LangSmith |
| **Web Search** | Tavily |
| **Vector Store** | ChromaDB + HuggingFace Embeddings |
| **Weather** | OpenWeatherMap API |

## Features

- 📸 **Multimodal image upload** — dish photos, fridge contents, pantry items
- 🤖 **AI recipe generation** — structured output with ingredients, steps, substitutions
- 💬 **Conversational chat** — "make it vegan", "for air fryer", "serve 4 people"
- 🧠 **Session memory** — remembers your preferences throughout the session
- 🛡️ **Safety guardrails** — confidence thresholds, allergy scanning, uncertain image handling
- 🥗 **Allergy filters** — peanut-free, dairy-free, gluten-free, egg-free, shellfish-free
- 💰 **Budget + health modes** — cheaper alternatives and healthier swaps
- 🛒 **Shopping list generator** — copy-to-clipboard
- 🌍 **Cuisine twists** — Indian, Italian, Korean, Mexican, Arabic variations
- 🔍 **Tavily live search** — real-time substitution and cooking tip lookups
- 📚 **RAG knowledge base** — curated cooking knowledge in ChromaDB
- 🌡️ **Weather-aware suggestions** — seasonal meal recommendations via OpenWeatherMap
- 📊 **LangSmith tracing** — full observability for every request

## Prerequisites

You need API keys for:
- [Groq](https://console.groq.com) (LLM + vision)
- [LangSmith](https://smith.langchain.com) (tracing)
- [Tavily](https://app.tavily.com) (web search)
- [OpenWeatherMap](https://openweathermap.org/api) (optional, weather suggestions)

## Local Setup

### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Copy and fill in environment variables
cp .env.example .env
# Edit .env with your API keys

# Run the backend
uvicorn main:app --reload --port 8000
```

The backend will be available at `http://localhost:8000`
API docs: `http://localhost:8000/docs`

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Copy and fill in environment variables
cp .env.example .env.local
# Edit .env.local:
#   NEXT_PUBLIC_API_URL=http://localhost:8000

# Run the frontend
npm run dev
```

The frontend will be available at `http://localhost:3000`

## Deployment

### Backend → Railway

1. Push your code to GitHub
2. Create a new project on [Railway](https://railway.app)
3. Connect your GitHub repo, select the `backend/` directory
4. Add all environment variables from `.env.example` in Railway dashboard
5. Railway will automatically detect the `Procfile` and deploy

### Frontend → Vercel

1. Create a new project on [Vercel](https://vercel.com)
2. Connect your GitHub repo, set the root directory to `frontend/`
3. Add environment variable: `NEXT_PUBLIC_API_URL=https://your-backend.railway.app`
4. Deploy!

## Project Structure

```
snapchef-ai/
├── backend/
│   ├── main.py                  # FastAPI app
│   ├── chains/                  # LangChain chains
│   │   ├── vision_chain.py      # Image identification (Groq vision)
│   │   ├── recipe_chain.py      # Recipe generation
│   │   └── chat_chain.py        # Conversational follow-ups
│   ├── tools/
│   │   ├── tavily_tool.py       # Tavily web search
│   │   └── weather_tool.py      # OpenWeatherMap
│   ├── rag/
│   │   ├── knowledge_base.py    # ChromaDB setup
│   │   ├── retriever.py         # RAG retrieval
│   │   └── docs/                # 5 cooking knowledge documents
│   ├── memory/                  # Session memory management
│   ├── guardrails/              # Input/output safety validation
│   └── models/schemas.py        # Pydantic schemas
│
└── frontend/
    ├── app/
    │   ├── page.tsx             # Landing page
    │   └── chat/page.tsx        # Recipe + chat view
    └── components/
        ├── ImageUploader.tsx
        ├── RecipeCard.tsx
        ├── ChatInterface.tsx
        ├── PreferencePanel.tsx
        ├── WeatherBanner.tsx
        └── LoadingChef.tsx
```

## LangSmith Traces

Every request is traced in LangSmith under the project `snapchef-ai`:

| Trace | What it captures |
|---|---|
| `analyze_image_endpoint` | Full request lifecycle |
| `identify_image` | Vision model call |
| `generate_recipe` | Recipe generation with RAG |
| `chat_follow_up` | Conversational responses |
| `rag_retrieval` | ChromaDB search |
| `tavily_search` | External web lookups |
| `get_weather_suggestion` | Weather API call |

## License

MIT
