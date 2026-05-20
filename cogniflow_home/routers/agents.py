"""Agent CRUD, cloning, knowledge base, test chat, and performance."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse

from cogniflow_home.agents import create_agent, get_agent_by_id, list_agents, update_agent
from cogniflow_home.config import settings
from cogniflow_home.db.supabase import db
from cogniflow_home.state import valid_uuid
from cogniflow_home.tenants.auth import AuthContext, get_auth_context

logger = logging.getLogger("cogniflow_home")

router = APIRouter(tags=["agents"])


_AGENT_DB_COLUMNS = {
    "name", "instructions", "voice_id", "language", "phone_numbers", "is_active",
    "metadata", "greeting", "guardrails", "llm_provider", "llm_model", "tts_provider",
    "tts_voice_name", "temperature", "tools_enabled", "max_call_duration",
    "enable_memory", "enable_prediction", "enable_emotion", "enable_language_switch",
    "enable_rag", "tenant_id",
}

_AGENT_EXTRA_FIELDS = {
    "emotion_profile", "voice_gender", "stt_language", "endpointing_ms", "smart_format",
    "max_tokens", "silence_timeout", "enable_recording", "enable_barge_in",
    "enable_speculative", "enable_filler", "webhook_url", "fallback_message",
    "max_retries", "concurrent_call_limit",
}


def _pack_agent_data(body: dict, tenant_id: str = "") -> dict:
    agent_data = {}
    extras = {}
    for k, v in body.items():
        if k in _AGENT_DB_COLUMNS:
            agent_data[k] = v
        elif k in _AGENT_EXTRA_FIELDS:
            extras[k] = v
    meta = agent_data.get("metadata") or {}
    if isinstance(meta, dict):
        meta.update(extras)
    else:
        meta = extras
    agent_data["metadata"] = meta
    if tenant_id:
        agent_data["tenant_id"] = tenant_id
    return agent_data


def _unpack_agent(row: dict) -> dict:
    if not row:
        return row
    meta = row.get("metadata") or {}
    for field in _AGENT_EXTRA_FIELDS:
        if field in meta and field not in row:
            row[field] = meta[field]
    return row


@router.get("/api/me")
async def api_me(auth: AuthContext = Depends(get_auth_context)):
    return {
        "tenant_id": auth.tenant_id,
        "tenant_name": auth.tenant_name,
        "plan": auth.plan,
        "scopes": auth.scopes,
        "is_admin": auth.is_admin,
    }


@router.get("/api/agents")
async def api_list_agents(auth: AuthContext = Depends(get_auth_context)):
    if auth.tenant_id:
        agents = await list_agents(tenant_id=auth.tenant_id)
    else:
        agents = await list_agents()
    return {"agents": [_unpack_agent(a) for a in agents]}


@router.post("/api/agents")
async def api_create_agent(request: Request, auth: AuthContext = Depends(get_auth_context)):
    body = await request.json()
    name = body.get("name")
    instructions = body.get("instructions")
    if not name or not instructions:
        return {"error": "name and instructions are required"}
    defaults = {
        "voice_id": "", "language": "en", "phone_numbers": [], "is_active": True,
        "greeting": "", "guardrails": {}, "llm_provider": "groq",
        "llm_model": "llama-3.3-70b-versatile", "tts_provider": "smallest",
        "temperature": 0.7, "tools_enabled": [], "max_call_duration": 600,
        "enable_memory": True, "enable_prediction": True, "enable_emotion": True,
        "enable_language_switch": True, "enable_rag": False,
        "emotion_profile": "friendly", "voice_gender": "female",
        "stt_language": "en", "endpointing_ms": 300, "smart_format": True,
        "max_tokens": 80, "silence_timeout": 10, "enable_recording": True,
        "enable_barge_in": True, "enable_speculative": True, "enable_filler": True,
        "webhook_url": "", "fallback_message": "", "max_retries": 3,
        "concurrent_call_limit": 5,
    }
    merged = {**defaults, **body, "name": name, "instructions": instructions}
    agent_data = _pack_agent_data(merged, auth.tenant_id)
    result = await create_agent(agent_data)
    if not result:
        return JSONResponse({"error": "Failed to create agent"}, status_code=500)
    return _unpack_agent(result)


@router.patch("/api/agents/{agent_id}")
async def api_update_agent(agent_id: str, request: Request, auth: AuthContext = Depends(get_auth_context)):
    if not valid_uuid(agent_id):
        return {"error": "Invalid agent ID format"}
    if auth.tenant_id:
        agents = await db.select("agents", {"id": agent_id, "tenant_id": auth.tenant_id})
        if not agents:
            return {"error": "Agent not found"}
    body = await request.json()
    allowed = _AGENT_DB_COLUMNS | _AGENT_EXTRA_FIELDS
    filtered = {k: v for k, v in body.items() if k in allowed}
    if not filtered:
        return {"error": "No valid fields to update"}
    db_updates = {k: v for k, v in filtered.items() if k in _AGENT_DB_COLUMNS}
    extras = {k: v for k, v in filtered.items() if k in _AGENT_EXTRA_FIELDS}
    if extras:
        existing = await db.select("agents", {"id": agent_id})
        old_meta = (existing[0].get("metadata") or {}) if existing else {}
        old_meta.update(extras)
        db_updates["metadata"] = old_meta
    result = await update_agent(agent_id, db_updates)
    return _unpack_agent(result) if result else {"error": "Agent not found"}


@router.get("/api/agents/{agent_id}")
async def api_get_agent(agent_id: str, auth: AuthContext = Depends(get_auth_context)):
    if not valid_uuid(agent_id):
        return {"error": "Invalid agent ID format"}
    match = {"id": agent_id}
    if auth.tenant_id:
        match["tenant_id"] = auth.tenant_id
    agents = await db.select("agents", match)
    if not agents:
        return {"error": "Agent not found"}
    return _unpack_agent(agents[0])


@router.delete("/api/agents/{agent_id}")
async def api_delete_agent(agent_id: str, auth: AuthContext = Depends(get_auth_context)):
    if not valid_uuid(agent_id):
        return {"error": "Invalid agent ID format"}
    match = {"id": agent_id}
    if auth.tenant_id:
        match["tenant_id"] = auth.tenant_id
    result = await db.delete("agents", match)
    return {"status": "deleted"} if result else {"error": "Agent not found"}


@router.get("/api/agents/{agent_id}/performance")
async def api_agent_performance(agent_id: str, auth: AuthContext = Depends(get_auth_context)):
    if not valid_uuid(agent_id):
        return {"error": "Invalid agent ID format"}
    if auth.tenant_id:
        agent_rows = await db.select("agents", {"id": agent_id, "tenant_id": auth.tenant_id})
        if not agent_rows:
            return {"error": "Agent not found"}
    calls = await db.select("calls", {"agent_id": agent_id}, order="created_at.desc", limit=200)
    total = len(calls)
    if total == 0:
        return {"total_calls": 0, "avg_duration": 0, "avg_sentiment": 0, "conversion_rate": 0, "dispositions": {}}
    durations = [c.get("duration_seconds", 0) for c in calls if c.get("duration_seconds")]
    sentiments = [c.get("sentiment_score", 0) for c in calls if c.get("sentiment_score") is not None]
    dispositions = {}
    for c in calls:
        d = c.get("disposition", "unknown")
        dispositions[d] = dispositions.get(d, 0) + 1
    interested = dispositions.get("interested", 0)
    return {
        "total_calls": total,
        "avg_duration": round(sum(durations) / len(durations), 1) if durations else 0,
        "avg_sentiment": round(sum(sentiments) / len(sentiments), 2) if sentiments else 0,
        "conversion_rate": round(interested / total * 100, 1) if total else 0,
        "dispositions": dispositions,
    }


@router.post("/api/agents/{agent_id}/test-chat")
async def api_test_agent_chat(agent_id: str, request: Request, auth: AuthContext = Depends(get_auth_context)):
    if not valid_uuid(agent_id):
        return JSONResponse({"error": "Invalid agent ID format"}, status_code=400)
    match = {"id": agent_id}
    if auth.tenant_id:
        match["tenant_id"] = auth.tenant_id
    agents = await db.select("agents", match)
    if not agents:
        return JSONResponse({"error": "Agent not found"}, status_code=404)
    agent = agents[0]
    body = await request.json()
    messages = body.get("messages", [])
    user_msg = body.get("message", "")
    if user_msg:
        messages.append({"role": "user", "content": user_msg})
    if not messages:
        return JSONResponse({"error": "No message provided"}, status_code=400)

    system_prompt = agent.get("instructions", "")
    greeting = agent.get("greeting", "")
    if greeting:
        system_prompt += f"\n\nYour greeting when starting a conversation: {greeting}"

    model = agent.get("llm_model", "llama-3.3-70b-versatile")
    temperature = agent.get("temperature", 0.7)

    try:
        from openai import AsyncOpenAI
        if not settings.groq_api_key:
            return JSONResponse({"error": "No LLM provider configured. Add GROQ_API_KEY to .env"}, status_code=500)
        client = AsyncOpenAI(
            api_key=settings.groq_api_key,
            base_url="https://api.groq.com/openai/v1",
        )
        resp = await client.chat.completions.create(
            model=model,
            messages=[{"role": "system", "content": system_prompt}] + messages,
            temperature=temperature,
            max_tokens=500,
        )
        reply = resp.choices[0].message.content
        return {"reply": reply, "model": model, "provider": "groq"}
    except Exception as e:
        logger.error(f"Test chat error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)


# ─── Agent Cloning ───

@router.post("/api/agents/clone")
async def api_clone_agent(request: Request, auth: AuthContext = Depends(get_auth_context)):
    body = await request.json()
    source_agent_id = body.get("source_agent_id")
    recording_urls = body.get("recording_urls", [])
    agent_name = body.get("name") or body.get("agent_name", "Cloned Agent")

    if source_agent_id:
        if not valid_uuid(source_agent_id):
            return {"error": "Invalid source_agent_id format"}
        agents = await db.select("agents", {"id": source_agent_id})
        if not agents:
            return {"error": "Source agent not found"}
        source = agents[0]
        if auth.tenant_id and source.get("tenant_id") != auth.tenant_id:
            return {"error": "Source agent not found"}
        clone_fields = {k: v for k, v in source.items() if k not in ("id", "created_at", "updated_at")}
        clone_fields["name"] = agent_name
        clone_fields["metadata"] = {**(clone_fields.get("metadata") or {}), "cloned_from": source_agent_id}
        if auth.tenant_id:
            clone_fields["tenant_id"] = auth.tenant_id
        result = await create_agent(clone_fields)
        return result or {"error": "Failed to clone agent"}

    if not recording_urls:
        return {"error": "source_agent_id or recording_urls is required"}
    from cogniflow_home.cloning.cloner import AgentCloner
    cloner = AgentCloner()
    try:
        system_prompt = await cloner.clone_from_recordings(recording_urls, agent_name)
        agent_data = {
            "name": agent_name,
            "instructions": system_prompt,
            "is_active": True,
            "metadata": {"cloned": True, "source_recordings": len(recording_urls)},
        }
        if auth.tenant_id:
            agent_data["tenant_id"] = auth.tenant_id
        result = await create_agent(agent_data)
        return result or {"error": "Failed to save cloned agent"}
    except Exception:
        logger.exception("Agent cloning failed")
        return {"error": "Agent cloning failed. Check server logs for details."}


# ─── Knowledge Base ───

@router.post("/api/agents/{agent_id}/knowledge")
async def upload_knowledge(agent_id: str, request: Request, auth: AuthContext = Depends(get_auth_context)):
    if not valid_uuid(agent_id):
        return {"error": "Invalid agent ID format"}
    if auth.tenant_id:
        agents = await db.select("agents", {"id": agent_id})
        if not agents or agents[0].get("tenant_id") != auth.tenant_id:
            return {"error": "Agent not found"}
    from cogniflow_home.knowledge.base import kb
    form = await request.form()
    file = form.get("file")
    if not file:
        return {"error": "file is required"}
    content = (await file.read()).decode("utf-8")
    if len(content) > 5_000_000:
        return {"error": "File too large. Max 5MB."}
    await kb.ingest_text(agent_id, content, source=file.filename)
    return {"status": "ingested", "source": file.filename}


@router.post("/api/agents/{agent_id}/knowledge/query")
async def query_knowledge(agent_id: str, request: Request, auth: AuthContext = Depends(get_auth_context)):
    if not valid_uuid(agent_id):
        return {"error": "Invalid agent ID format"}
    if auth.tenant_id:
        agents = await db.select("agents", {"id": agent_id})
        if not agents or agents[0].get("tenant_id") != auth.tenant_id:
            return {"error": "Agent not found"}
    from cogniflow_home.knowledge.base import kb
    body = await request.json()
    results = await kb.query(agent_id, body.get("question", ""))
    return {"results": results}


@router.delete("/api/agents/{agent_id}/knowledge/{source}")
async def delete_knowledge(agent_id: str, source: str, auth: AuthContext = Depends(get_auth_context)):
    if not valid_uuid(agent_id):
        return {"error": "Invalid agent ID format"}
    if auth.tenant_id:
        agents = await db.select("agents", {"id": agent_id})
        if not agents or agents[0].get("tenant_id") != auth.tenant_id:
            return {"error": "Agent not found"}
    from cogniflow_home.knowledge.base import kb
    await kb.delete_source(agent_id, source)
    return {"status": "deleted"}
