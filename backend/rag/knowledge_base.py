"""
SnapChef AI — RAG Knowledge Base
Loads cooking knowledge documents into ChromaDB vector store.
"""

import os
import logging
from pathlib import Path

from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings

logger = logging.getLogger(__name__)

DOCS_DIR = Path(__file__).parent / "docs"
CHROMA_PERSIST_DIR = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")
COLLECTION_NAME = "snapchef_cooking_knowledge"
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

# Global singleton
_vector_store: Chroma | None = None
_embeddings: HuggingFaceEmbeddings | None = None


def get_embeddings() -> HuggingFaceEmbeddings:
    global _embeddings
    if _embeddings is None:
        cache_folder = os.path.join(CHROMA_PERSIST_DIR, "models")
        os.makedirs(cache_folder, exist_ok=True)
        
        logger.info(f"Loading embedding model: {EMBEDDING_MODEL}")
        _embeddings = HuggingFaceEmbeddings(
            model_name=EMBEDDING_MODEL,
            cache_folder=cache_folder,
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True},
            # Strict offline mode ensures we never pause to check the internet
            multi_process=False,
        )
    return _embeddings


def get_vector_store() -> Chroma:
    global _vector_store
    if _vector_store is None:
        _vector_store = _initialize_vector_store()
    return _vector_store


def _initialize_vector_store() -> Chroma:
    """
    Loads or creates the ChromaDB vector store.
    Only re-embeds if collection is empty.
    """
    embeddings = get_embeddings()

    vector_store = Chroma(
        collection_name=COLLECTION_NAME,
        embedding_function=embeddings,
        persist_directory=CHROMA_PERSIST_DIR,
    )

    # Check if already populated
    existing_count = vector_store._collection.count()
    if existing_count > 0:
        logger.info(
            f"ChromaDB loaded with {existing_count} existing chunks. Skipping re-embedding."
        )
        return vector_store

    # Load and embed documents
    logger.info("ChromaDB empty — loading cooking knowledge documents...")
    docs = _load_documents()

    if not docs:
        logger.warning("No documents found to embed!")
        return vector_store

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    chunks = splitter.split_documents(docs)

    logger.info(f"Embedding {len(chunks)} chunks from {len(docs)} documents...")
    vector_store.add_documents(chunks)
    logger.info("ChromaDB embedding complete and persisted.")

    return vector_store


def _load_documents():
    """Loads all .txt documents from the docs directory."""
    documents = []
    doc_files = list(DOCS_DIR.glob("*.txt"))

    if not doc_files:
        logger.error(f"No .txt files found in {DOCS_DIR}")
        return documents

    for filepath in doc_files:
        try:
            loader = TextLoader(str(filepath), encoding="utf-8")
            docs = loader.load()
            # Add source metadata
            for doc in docs:
                doc.metadata["source"] = filepath.name
            documents.extend(docs)
            logger.info(f"Loaded: {filepath.name}")
        except Exception as e:
            logger.error(f"Failed to load {filepath.name}: {e}")

    logger.info(f"Loaded {len(documents)} documents total.")
    return documents
