"""
RAG-powered knowledge base.
Upload documents → chunk → embed → store in Supabase pgvector.
During calls → semantic search → inject context into LLM prompt.
"""

import hashlib
import logging

import httpx

from cogniflow_home.config import settings
from cogniflow_home.db.supabase import db

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50


class KnowledgeBase:
    """Manage and query a per-agent knowledge base."""

    async def ingest_text(self, agent_id: str, text: str, source: str):
        chunks = self._chunk_text(text)
        logger.info(f"Ingesting {len(chunks)} chunks from {source} for agent {agent_id}")

        for i, chunk in enumerate(chunks):
            embedding = await self._embed(chunk)
            chunk_id = hashlib.md5(f"{agent_id}:{source}:{i}".encode()).hexdigest()

            await db.upsert("knowledge_chunks", {
                "id": chunk_id,
                "agent_id": agent_id,
                "source": source,
                "chunk_index": i,
                "content": chunk,
                "embedding": embedding,
            })

    async def query(self, agent_id: str, question: str, top_k: int = 3) -> list[dict]:
        q_embedding = await self._embed(question)

        results = await db.rpc("match_knowledge", {
            "query_embedding": q_embedding,
            "match_agent_id": agent_id,
            "match_count": top_k,
            "match_threshold": 0.5,
        })

        return results or []

    def build_context_prompt(self, results: list[dict]) -> str:
        if not results:
            return ""

        context_parts = ["\n[KNOWLEDGE BASE — use this information to answer]"]
        for r in results:
            context_parts.append(f"Source: {r.get('source', 'unknown')}")
            context_parts.append(r.get("content", ""))
            context_parts.append("---")

        context_parts.append(
            "Answer based on the above information. If the information "
            "doesn't cover the question, say 'I don't have that information "
            "in my knowledge base, let me transfer you to someone who can help.'"
        )

        return "\n".join(context_parts)

    def _chunk_text(self, text: str) -> list[str]:
        words = text.split()
        chunks = []
        for i in range(0, len(words), CHUNK_SIZE - CHUNK_OVERLAP):
            chunk = " ".join(words[i:i + CHUNK_SIZE])
            if chunk.strip():
                chunks.append(chunk)
        return chunks

    async def _embed(self, text: str) -> list[float]:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/embeddings",
                    headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                    json={"model": EMBEDDING_MODEL, "input": text},
                )
                if resp.status_code != 200:
                    logger.error(f"Embedding API error: {resp.status_code}")
                    return [0.0] * EMBEDDING_DIM
                data = resp.json()
                return data["data"][0]["embedding"]
        except Exception:
            logger.exception("Embedding request failed")
            return [0.0] * EMBEDDING_DIM

    async def delete_source(self, agent_id: str, source: str):
        await db.delete("knowledge_chunks", {
            "agent_id": f"eq.{agent_id}",
            "source": f"eq.{source}",
        })


kb = KnowledgeBase()
