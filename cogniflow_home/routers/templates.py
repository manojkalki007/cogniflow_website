"""Agent templates — list, get, and deploy."""

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse

from cogniflow_home.agents import create_agent
from cogniflow_home.config import settings
from cogniflow_home.tenants.auth import AuthContext, get_auth_context

router = APIRouter(tags=["templates"])


@router.get("/api/templates")
async def api_list_templates(auth: AuthContext = Depends(get_auth_context)):
    from cogniflow_home.templates.registry import list_templates
    return {"templates": list_templates()}


@router.get("/api/templates/{template_id}")
async def api_get_template(template_id: str, auth: AuthContext = Depends(get_auth_context)):
    from cogniflow_home.templates.registry import get_template
    tpl = get_template(template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return tpl


@router.post("/api/templates/{template_id}/deploy")
async def api_deploy_template(template_id: str, request: Request, auth: AuthContext = Depends(get_auth_context)):
    from cogniflow_home.templates.registry import get_template
    tpl = get_template(template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")

    body = {}
    try:
        body = await request.json()
    except Exception:
        pass

    company_name = body.get("company_name", "My Company")
    agent_name = body.get("name", tpl["persona"]["agent_name"])
    instructions_extra = body.get("instructions_extra", "")

    instructions = tpl["instructions"].replace("{{COMPANY_NAME}}", company_name)
    if instructions_extra:
        instructions += f"\n\nADDITIONAL INSTRUCTIONS:\n{instructions_extra}"

    llm_provider, llm_model = "groq", "llama-3.3-70b-versatile"

    lang = tpl["languages"][0] if tpl["languages"] else "en"
    indian_langs = {"hi", "ta", "te", "kn", "ml", "bn", "mr", "gu", "pa", "od"}

    if lang in indian_langs and settings.sarvam_api_key:
        tts_provider = "sarvam"
    elif settings.smallest_ai_api_key:
        tts_provider = "smallest"
    elif settings.sarvam_api_key:
        tts_provider = "sarvam"
    else:
        tts_provider = "smallest"

    llm_provider = body.get("llm_provider", llm_provider)
    llm_model = body.get("llm_model", llm_model)
    tts_provider = body.get("tts_provider", tts_provider)

    agent_data = {
        "name": agent_name,
        "instructions": instructions,
        "greeting": f"Hello, this is {agent_name} from {company_name}.",
        "language": lang,
        "llm_provider": llm_provider,
        "llm_model": llm_model,
        "tts_provider": tts_provider,
        "voice_id": body.get("voice_id", tpl["persona"].get("voice_id", "")),
        "tools_enabled": list({*tpl.get("tools_used", []), "schedule_callback", "end_call"}),
        "metadata": {"template_id": template_id},
    }
    if auth.tenant_id:
        agent_data["tenant_id"] = auth.tenant_id
    agent = await create_agent(agent_data)
    if not agent:
        return JSONResponse({"error": "Failed to deploy template agent"}, status_code=500)
    return {
        "agent_id": str(agent.get("id", "")),
        "agent_name": agent.get("name", agent_name),
        "template_id": template_id,
        "providers": {"llm": llm_provider, "tts": tts_provider},
        "status": "deployed",
    }
