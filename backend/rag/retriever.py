"""
SnapChef AI — RAG Retriever
Retrieves relevant cooking knowledge from ChromaDB vector store.
"""

import logging
from langsmith import traceable
from rag.knowledge_base import get_vector_store

logger = logging.getLogger(__name__)


@traceable(name="rag_retrieval")
def get_relevant_context(query: str, k: int = 3) -> str:
    """
    Retrieves top-k relevant chunks from the cooking knowledge base.
    
    Args:
        query: The search query (e.g., "substitute for butter dairy free")
        k: Number of chunks to retrieve
    
    Returns:
        Formatted string of relevant cooking knowledge
    """
    try:
        vector_store = get_vector_store()
        results = vector_store.similarity_search(query, k=k)

        if not results:
            return ""

        formatted_chunks = []
        for i, doc in enumerate(results, 1):
            source = doc.metadata.get("source", "cooking guide")
            formatted_chunks.append(
                f"[Cooking Knowledge {i} — from {source}]\n{doc.page_content}"
            )

        context = "\n\n---\n\n".join(formatted_chunks)
        logger.info(f"RAG retrieved {len(results)} chunks for query: '{query[:60]}...'")
        return context

    except Exception as e:
        logger.error(f"RAG retrieval failed: {e}")
        return ""


def get_allergen_context(restrictions: list[str]) -> str:
    """Retrieves allergen substitution knowledge for given restrictions."""
    if not restrictions:
        return ""
    query = f"substitutes for {' and '.join(restrictions)} free cooking"
    return get_relevant_context(query, k=2)


def get_cuisine_context(cuisine: str) -> str:
    """Retrieves flavor profile for a specific cuisine."""
    query = f"{cuisine} cuisine flavors spices ingredients cooking style"
    return get_relevant_context(query, k=2)


def get_equipment_context(equipment: list[str]) -> str:
    """Retrieves cooking method info for given equipment."""
    if not equipment:
        return ""
    query = f"{' '.join(equipment)} cooking method temperature time conversion"
    return get_relevant_context(query, k=2)
