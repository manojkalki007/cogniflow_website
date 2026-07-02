"""Agent CRUD, cloning, knowledge base, test chat, and performance."""

import json
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

_groq_client = None


def _get_groq_client():
    global _groq_client
    if _groq_client is None:
        from openai import AsyncOpenAI
        _groq_client = AsyncOpenAI(
            api_key=settings.groq_api_key,
            base_url="https://api.groq.com/openai/v1",
        )
    return _groq_client


_AGENT_COLUMNS = {
    "name", "instructions", "greeting", "voice_id", "language", "llm_provider",
    "llm_model", "tts_provider", "voice_gender", "emotion_profile", "stt_language",
    "temperature", "max_tokens", "endpointing_ms", "smart_format",
    "max_call_duration", "silence_timeout", "enable_recording", "enable_barge_in",
    "enable_memory", "enable_prediction", "enable_emotion", "enable_language_switch",
    "enable_rag", "enable_speculative", "enable_filler", "tools_enabled",
    "webhook_url", "fallback_message", "max_retries", "concurrent_call_limit",
    "is_active", "phone_numbers", "voice_speed",
}

_META_FIELDS = {"integration_config", "variables"}


def _pack_agent_data(body: dict, tenant_id: str = "") -> dict:
    agent_data = {}
    meta_extras = {}
    for k, v in body.items():
        if k in _AGENT_COLUMNS:
            agent_data[k] = v
        elif k in _META_FIELDS:
            meta_extras[k] = v
    if meta_extras:
        old_meta = agent_data.pop("metadata", None) or {}
        if not isinstance(old_meta, dict):
            old_meta = {}
        old_meta.update(meta_extras)
        agent_data["metadata"] = json.dumps(old_meta) if isinstance(old_meta, dict) else old_meta
    if tenant_id:
        agent_data["tenant_id"] = tenant_id
    agent_data.setdefault("is_active", True)
    if "instructions" in agent_data:
        agent_data["system_prompt"] = agent_data["instructions"]
    if "greeting" in agent_data:
        agent_data["welcome_message"] = agent_data["greeting"]
    if "tts_provider" in agent_data:
        agent_data["voice_provider"] = agent_data["tts_provider"]
    return agent_data


def _unpack_agent(row: dict) -> dict:
    if not row:
        return row
    r = {**row}
    raw = r.get("metadata")
    meta = {}
    if raw:
        if isinstance(raw, str):
            try:
                meta = json.loads(raw)
            except Exception:
                meta = {}
        elif isinstance(raw, dict):
            meta = raw
    r["metadata"] = meta
    for field in _META_FIELDS:
        if field in meta and field not in r:
            r[field] = meta[field]
    return r


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
    match = {"id": agent_id}
    if auth.tenant_id:
        match["tenant_id"] = auth.tenant_id
    existing = await db.select("agents", match)
    if not existing:
        return {"error": "Agent not found"}
    body = await request.json()
    db_updates = {}
    meta_extras = {}
    for k, v in body.items():
        if k in _AGENT_COLUMNS:
            db_updates[k] = v
        elif k in _META_FIELDS:
            meta_extras[k] = v
    if meta_extras:
        old_meta = existing[0].get("metadata") or {}
        if isinstance(old_meta, str):
            try:
                old_meta = json.loads(old_meta)
            except Exception:
                old_meta = {}
        old_meta.update(meta_extras)
        db_updates["metadata"] = json.dumps(old_meta)
    if not db_updates:
        return {"error": "No valid fields to update"}
    result = await update_agent(agent_id, db_updates, tenant_id=auth.tenant_id)
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
    calls_match = {"agent_id": agent_id}
    if auth.tenant_id:
        calls_match["tenant_id"] = auth.tenant_id
    calls = await db.select("calls", calls_match, order="created_at.desc", limit=200)
    total = len(calls)
    if total == 0:
        return {"total_calls": 0, "avg_duration": 0, "statuses": {}}
    durations = [c.get("duration_seconds", 0) for c in calls if c.get("duration_seconds")]
    statuses = {}
    for c in calls:
        s = c.get("status", "unknown")
        statuses[s] = statuses.get(s, 0) + 1
    return {
        "total_calls": total,
        "avg_duration": round(sum(durations) / len(durations), 1) if durations else 0,
        "statuses": statuses,
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
    agent = _unpack_agent(agents[0])
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

    meta = agent.get("metadata") or {}
    variables = meta.get("variables") or agent.get("variables") or []
    if variables:
        from cogniflow_home.emotions.prompt_builder import build_variables_prompt
        vp = build_variables_prompt(variables)
        if vp:
            system_prompt += "\n\n" + vp

    model = agent.get("llm_model", "llama-3.3-70b-versatile")
    temperature = agent.get("temperature", 0.7)

    try:
        if not settings.groq_api_key:
            return JSONResponse({"error": "No LLM provider configured. Add GROQ_API_KEY to .env"}, status_code=500)
        client = _get_groq_client()

        tools_enabled = agent.get("tools_enabled") or []
        from cogniflow_home.providers.tools import TOOL_DEFINITIONS
        tools = [t for t in TOOL_DEFINITIONS if t["function"]["name"] in tools_enabled
                 and t["function"]["name"] not in ("end_call", "transfer_call")]

        kwargs = dict(
            model=model,
            messages=[{"role": "system", "content": system_prompt}] + messages,
            temperature=temperature,
            max_tokens=500,
        )
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"

        resp = await client.chat.completions.create(**kwargs)
        choice = resp.choices[0]

        if choice.message.tool_calls:
            tool_results = []
            for tc in choice.message.tool_calls:
                tool_results.append(f"[Tool: {tc.function.name}({tc.function.arguments})]")
            reply = (choice.message.content or "") + " " + " ".join(tool_results)
            reply = reply.strip()
        else:
            reply = choice.message.content

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
        skip_cols = {"id", "created_at", "updated_at"}
        clone_fields = {k: v for k, v in source.items() if k not in skip_cols}
        clone_fields["name"] = agent_name
        meta = clone_fields.get("metadata") or {}
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except Exception:
                meta = {}
        meta["cloned_from"] = source_agent_id
        clone_fields["metadata"] = json.dumps(meta)
        if auth.tenant_id:
            clone_fields["tenant_id"] = auth.tenant_id
        result = await create_agent(clone_fields)
        return result or {"error": "Failed to clone agent"}

    if not recording_urls:
        return {"error": "source_agent_id or recording_urls is required"}
    from cogniflow_home.cloning.cloner import AgentCloner
    cloner = AgentCloner()
    try:
        instructions = await cloner.clone_from_recordings(recording_urls, agent_name)
        agent_data = _pack_agent_data({
            "name": agent_name,
            "instructions": instructions,
        }, auth.tenant_id)
        agent_data["metadata"] = json.dumps({
            "cloned": True,
            "source_recordings": len(recording_urls),
        })
        result = await create_agent(agent_data)
        return result or {"error": "Failed to save cloned agent"}
    except Exception:
        logger.exception("Agent cloning failed")
        return {"error": "Agent cloning failed. Check server logs for details."}


# ─── Knowledge Base ───

@router.get("/api/agents/{agent_id}/knowledge")
async def list_knowledge(agent_id: str, auth: AuthContext = Depends(get_auth_context)):
    if not valid_uuid(agent_id):
        return {"error": "Invalid agent ID format"}
    if auth.tenant_id:
        agents = await db.select("agents", {"id": agent_id})
        if not agents or agents[0].get("tenant_id") != auth.tenant_id:
            return {"error": "Agent not found"}
    rows = await db.select("knowledge_chunks", {"agent_id": agent_id})
    sources = {}
    for r in (rows or []):
        src = r.get("source", "unknown")
        if src not in sources:
            sources[src] = {"source": src, "chunks": 0, "created_at": r.get("created_at")}
        sources[src]["chunks"] += 1
    return {"sources": list(sources.values())}


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
