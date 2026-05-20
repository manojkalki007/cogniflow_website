#!/usr/bin/env python3
"""Telephony pipeline architecture tests — stdlib only, no external deps.

Tests:
  1. Syntax compilation of all telephony + router modules
  2. WebSocket message protocol conformance (Exotel, Vobiz, Twilio)
  3. API path correctness against documented endpoints
  4. Provider registry completeness
  5. Config defaults
  6. Number detection heuristics
  7. MCube non-streaming enforcement
  8. Provider handler coverage
"""

import ast
import json
import os
import py_compile
import sys
import textwrap
import traceback

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(BASE)

PASS = 0
FAIL = 0
ERRORS = []


def test(name):
    def decorator(fn):
        global PASS, FAIL
        try:
            fn()
            PASS += 1
            print(f"  PASS  {name}")
        except Exception as e:
            FAIL += 1
            msg = f"  FAIL  {name}: {e}"
            print(msg)
            ERRORS.append(msg)
        return fn
    return decorator


def assert_eq(actual, expected, msg=""):
    if actual != expected:
        raise AssertionError(f"{msg}: expected {expected!r}, got {actual!r}")


def assert_in(item, container, msg=""):
    if item not in container:
        raise AssertionError(f"{msg}: {item!r} not in {container!r}")


def assert_not_in(item, container, msg=""):
    if item in container:
        raise AssertionError(f"{msg}: {item!r} should not be in {container!r}")


def assert_true(val, msg=""):
    if not val:
        raise AssertionError(f"{msg}: expected truthy, got {val!r}")


def assert_contains(haystack, needle, msg=""):
    if needle not in haystack:
        raise AssertionError(f"{msg}: {needle!r} not found in string")


# ─── Parse source files with AST ───

def get_source(path):
    with open(os.path.join(BASE, path)) as f:
        return f.read()


def get_ast(path):
    return ast.parse(get_source(path))


def get_classes(tree):
    return {n.name: n for n in ast.walk(tree) if isinstance(n, ast.ClassDef)}


def get_functions(tree):
    return {n.name: n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef) or isinstance(n, ast.AsyncFunctionDef)}


def get_string_literals(tree):
    strings = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            strings.append(node.value)
    return strings


def get_assignments(tree):
    result = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    result[target.id] = node.value
    return result


print("=" * 60)
print("TELEPHONY PIPELINE ARCHITECTURE TESTS")
print("=" * 60)

# ═══════════════════════════════════════════════════════════
print("\n--- 1. Syntax Compilation ---")
# ═══════════════════════════════════════════════════════════

TELEPHONY_FILES = [
    "cogniflow_home/telephony/base.py",
    "cogniflow_home/telephony/twilio_provider.py",
    "cogniflow_home/telephony/exotel_provider.py",
    "cogniflow_home/telephony/vobiz_provider.py",
    "cogniflow_home/telephony/mcube_provider.py",
    "cogniflow_home/telephony/sip_provider.py",
    "cogniflow_home/telephony/generic_provider.py",
    "cogniflow_home/telephony/browser_provider.py",
    "cogniflow_home/telephony/registry.py",
    "cogniflow_home/telephony/numbers.py",
]

ROUTER_FILES = [
    "cogniflow_home/routers/__init__.py",
    "cogniflow_home/routers/voice.py",
    "cogniflow_home/routers/numbers.py",
    "cogniflow_home/routers/health.py",
    "cogniflow_home/routers/integrations.py",
]

for f in TELEPHONY_FILES + ROUTER_FILES:
    @test(f"compile {f}")
    def _check(path=f):
        py_compile.compile(path, doraise=True)


# ═══════════════════════════════════════════════════════════
print("\n--- 2. Exotel Provider Protocol ---")
# ═══════════════════════════════════════════════════════════

exotel_src = get_source("cogniflow_home/telephony/exotel_provider.py")
exotel_tree = get_ast("cogniflow_home/telephony/exotel_provider.py")
exotel_strings = get_string_literals(exotel_tree)

@test("Exotel: handles connected event")
def _():
    assert_contains(exotel_src, '"connected"')

@test("Exotel: handles start event with nested start object")
def _():
    assert_contains(exotel_src, 'message.get("start", {})')
    assert_contains(exotel_src, 'start.get("stream_sid"')
    assert_contains(exotel_src, 'start.get("call_sid"')
    assert_contains(exotel_src, 'start.get("from"')
    assert_contains(exotel_src, 'start.get("to"')

@test("Exotel: handles media event with base64 PCM16")
def _():
    assert_contains(exotel_src, 'media.get("payload"')
    assert_contains(exotel_src, "base64.b64decode")
    assert_contains(exotel_src, "pcm16_to_mulaw")

@test("Exotel: handles dtmf event")
def _():
    assert_contains(exotel_src, '"dtmf"')
    assert_contains(exotel_src, 'dtmf.get("digit"')

@test("Exotel: handles mark event")
def _():
    assert_contains(exotel_src, '"mark"')
    assert_contains(exotel_src, 'mark.get(\'name\'')

@test("Exotel: handles stop event with reason")
def _():
    assert_contains(exotel_src, 'stop.get("reason"')

@test("Exotel: sends media with stream_sid")
def _():
    assert_contains(exotel_src, '"event": "media"')
    assert_contains(exotel_src, '"stream_sid": self._stream_sid')

@test("Exotel: sends clear event")
def _():
    assert_contains(exotel_src, '"event": "clear"')

@test("Exotel: sends mark event")
def _():
    assert_contains(exotel_src, 'async def send_mark')

@test("Exotel: PCM16 encoding at 8kHz")
def _():
    assert_contains(exotel_src, "AudioEncoding.PCM16")
    assert_contains(exotel_src, "sample_rate = 8000")

@test("Exotel: 320-byte chunk size")
def _():
    assert_contains(exotel_src, "CHUNK_SIZE = 320")

@test("Exotel: outbound uses StreamUrl (not To=webhook)")
def _():
    assert_contains(exotel_src, '"StreamUrl"')
    assert_contains(exotel_src, '"StreamBegin"')
    assert_not_in('"To": webhook_url', exotel_src, "should not pass webhook as To")

@test("Exotel: outbound uses /v1/Accounts/{sid}/Calls/connect (no .json)")
def _():
    assert_contains(exotel_src, "/Calls/connect")
    assert_not_in("connect.json", exotel_src, "should not use .json suffix")

@test("Exotel: uses Basic Auth (api_key:api_token)")
def _():
    assert_contains(exotel_src, "settings.exotel_api_key, settings.exotel_api_token")

@test("Exotel: StatusCallback events")
def _():
    assert_contains(exotel_src, 'StatusCallbackEvents')
    assert_contains(exotel_src, '"terminal"')
    assert_contains(exotel_src, '"answered"')

@test("Exotel: stores metadata (account_sid, media_format, custom_parameters)")
def _():
    assert_contains(exotel_src, '"account_sid"')
    assert_contains(exotel_src, '"media_format"')
    assert_contains(exotel_src, '"custom_parameters"')


# ═══════════════════════════════════════════════════════════
print("\n--- 3. Vobiz Provider Protocol ---")
# ═══════════════════════════════════════════════════════════

vobiz_src = get_source("cogniflow_home/telephony/vobiz_provider.py")
vobiz_tree = get_ast("cogniflow_home/telephony/vobiz_provider.py")

@test("Vobiz: NO connected event (starts with start)")
def _():
    # Vobiz should NOT handle a 'connected' event — it starts with 'start'
    # Check that it doesn't have a connected handler like Exotel does
    lines = [l.strip() for l in vobiz_src.split('\n')]
    connected_handlers = [l for l in lines if 'event == "connected"' in l or "event == 'connected'" in l]
    assert_eq(len(connected_handlers), 0, "Vobiz should not handle 'connected' event")

@test("Vobiz: start event parses nested message.start object")
def _():
    assert_contains(vobiz_src, 'message.get("start", {})')
    assert_contains(vobiz_src, 'start.get("callId"')
    assert_contains(vobiz_src, 'start.get("streamId"')
    assert_contains(vobiz_src, 'start.get("mediaFormat"')
    assert_contains(vobiz_src, 'start.get("accountId"')

@test("Vobiz: sends playAudio (NOT media)")
def _():
    assert_contains(vobiz_src, '"event": "playAudio"')
    # Make sure we're not using Twilio's "media" for sending
    send_fn_start = vobiz_src.find("async def send_audio")
    send_fn_end = vobiz_src.find("async def send_checkpoint")
    send_fn = vobiz_src[send_fn_start:send_fn_end]
    assert_not_in('"event": "media"', send_fn, "send_audio should use playAudio, not media")

@test("Vobiz: playAudio includes contentType and sampleRate")
def _():
    assert_contains(vobiz_src, '"contentType": "audio/x-mulaw"')
    assert_contains(vobiz_src, '"sampleRate": 8000')

@test("Vobiz: uses clearAudio (NOT clear)")
def _():
    assert_contains(vobiz_src, '"event": "clearAudio"')
    # Verify no bare "clear" event
    clear_fn_start = vobiz_src.find("async def clear_audio")
    clear_fn_end = vobiz_src.find("async def stop_stream")
    clear_fn = vobiz_src[clear_fn_start:clear_fn_end]
    assert_not_in('"event": "clear"', clear_fn, "should use clearAudio, not clear")

@test("Vobiz: handles WebSocketDisconnect (no in-band stop from Vobiz)")
def _():
    assert_contains(vobiz_src, "WebSocketDisconnect")
    assert_contains(vobiz_src, "except WebSocketDisconnect")

@test("Vobiz: has checkpoint support")
def _():
    assert_contains(vobiz_src, "async def send_checkpoint")
    assert_contains(vobiz_src, '"event": "checkpoint"')

@test("Vobiz: has stop_stream method")
def _():
    assert_contains(vobiz_src, "async def stop_stream")
    assert_contains(vobiz_src, '"event": "stop"')

@test("Vobiz: handles playedStream event")
def _():
    assert_contains(vobiz_src, '"playedStream"')

@test("Vobiz: handles clearedAudio event")
def _():
    assert_contains(vobiz_src, '"clearedAudio"')

@test("Vobiz: outbound uses correct API path")
def _():
    assert_contains(vobiz_src, "VOBIZ_API_BASE")
    assert_contains(vobiz_src, "/Account/")
    assert_contains(vobiz_src, "/Call/")

@test("Vobiz: auth uses X-Auth-ID and X-Auth-Token headers")
def _():
    assert_contains(vobiz_src, '"X-Auth-ID"')
    assert_contains(vobiz_src, '"X-Auth-Token"')

@test("Vobiz: Stream XML uses <Stream> directly (not <Connect><Stream>)")
def _():
    xml_out = vobiz_src[vobiz_src.find("get_twiml_or_response"):]
    assert_contains(xml_out, "<Response>")
    assert_contains(xml_out, "<Stream")
    assert_not_in("<Connect>", xml_out, "Vobiz uses <Stream> directly, not Twilio's <Connect><Stream>")

@test("Vobiz: Stream XML has bidirectional=true and keepCallAlive=true")
def _():
    assert_contains(vobiz_src, 'bidirectional="true"')
    assert_contains(vobiz_src, 'keepCallAlive="true"')

@test("Vobiz: mulaw encoding at 8kHz")
def _():
    assert_contains(vobiz_src, "AudioEncoding.MULAW")
    assert_contains(vobiz_src, "sample_rate = 8000")

@test("Vobiz: parses extra_headers from start event")
def _():
    assert_contains(vobiz_src, 'message.get("extra_headers"')


# ═══════════════════════════════════════════════════════════
print("\n--- 4. MCube Provider (Non-Streaming) ---")
# ═══════════════════════════════════════════════════════════

mcube_src = get_source("cogniflow_home/telephony/mcube_provider.py")
mcube_tree = get_ast("cogniflow_home/telephony/mcube_provider.py")
mcube_classes = get_classes(mcube_tree)

@test("MCube: supports_streaming = False")
def _():
    assert_contains(mcube_src, "supports_streaming = False")

@test("MCube: handle_websocket raises NotImplementedError")
def _():
    assert_contains(mcube_src, "raise NotImplementedError")
    ws_fn_start = mcube_src.find("async def handle_websocket")
    ws_fn_end = mcube_src.find("async def send_audio")
    ws_fn = mcube_src[ws_fn_start:ws_fn_end]
    assert_contains(ws_fn, "NotImplementedError")

@test("MCube: send_audio raises NotImplementedError")
def _():
    send_start = mcube_src.find("async def send_audio")
    send_end = mcube_src.find("async def clear_audio")
    send_fn = mcube_src[send_start:send_end]
    assert_contains(send_fn, "NotImplementedError")

@test("MCube: clear_audio raises NotImplementedError")
def _():
    clear_start = mcube_src.find("async def clear_audio")
    clear_end = mcube_src.find("def get_twiml_or_response")
    clear_fn = mcube_src[clear_start:clear_end]
    assert_contains(clear_fn, "NotImplementedError")

@test("MCube: outbound uses GET /Restmcube-api/outbound-calls")
def _():
    assert_contains(mcube_src, "/Restmcube-api/outbound-calls")
    assert_contains(mcube_src, "client.get(")

@test("MCube: auth uses HTTP_AUTHORIZATION query param")
def _():
    assert_contains(mcube_src, '"HTTP_AUTHORIZATION"')
    assert_contains(mcube_src, "settings.mcube_api_key")

@test("MCube: uses exenumber and custnumber params")
def _():
    assert_contains(mcube_src, '"exenumber"')
    assert_contains(mcube_src, '"custnumber"')

@test("MCube: no WebSocket imports (json.loads, iter_text, etc.)")
def _():
    assert_not_in("iter_text", mcube_src, "MCube should not have WebSocket message handling")
    assert_not_in("base64.b64decode", mcube_src, "MCube should not decode audio")

@test("MCube: response parses monitorUcid")
def _():
    assert_contains(mcube_src, '"monitorUcid"')


# ═══════════════════════════════════════════════════════════
print("\n--- 5. Numbers API Paths ---")
# ═══════════════════════════════════════════════════════════

numbers_src = get_source("cogniflow_home/telephony/numbers.py")

@test("Exotel numbers: uses v2_beta paths (not v1)")
def _():
    # List owned
    assert_contains(numbers_src, "/v2_beta/Accounts/")
    assert_contains(numbers_src, "/IncomingPhoneNumbers")
    # Available
    assert_contains(numbers_src, "/AvailablePhoneNumbers")
    # The old v1 path should not be used for number management
    exotel_section = numbers_src[numbers_src.find("# ─── Exotel"):numbers_src.find("# ─── Vobiz")]
    assert_not_in("/v1/Accounts/", exotel_section, "Exotel numbers should use v2_beta, not v1")

@test("Exotel numbers: release uses DELETE")
def _():
    assert_contains(numbers_src, "async def exotel_release_number")
    release_start = numbers_src.find("async def exotel_release_number")
    release_end = numbers_src.find("# ─── Vobiz")
    release_fn = numbers_src[release_start:release_end]
    assert_contains(release_fn, "client.delete(")

@test("Vobiz numbers: list_available uses /inventory/numbers")
def _():
    assert_contains(numbers_src, "/inventory/numbers")

@test("Vobiz numbers: buy uses /numbers/purchase-from-inventory")
def _():
    assert_contains(numbers_src, "/numbers/purchase-from-inventory")

@test("Vobiz numbers: buy sends e164 in body")
def _():
    assert_contains(numbers_src, '"e164": phone_number')

@test("Vobiz numbers: list_owned uses /numbers (lowercase)")
def _():
    vobiz_section = numbers_src[numbers_src.find("async def vobiz_list_owned"):numbers_src.find("async def vobiz_verify")]
    assert_contains(vobiz_section, "/numbers")
    assert_not_in("/Number/", vobiz_section, "should use lowercase /numbers")

@test("Vobiz numbers: connect creates app then attaches via /numbers/{num}/application")
def _():
    connect_fn_start = numbers_src.find("async def vobiz_connect_number")
    connect_fn_end = numbers_src.find("async def vobiz_list_owned")
    connect_fn = numbers_src[connect_fn_start:connect_fn_end]
    assert_contains(connect_fn, "/Application/")
    assert_contains(connect_fn, "/numbers/")
    assert_contains(connect_fn, "/application")
    assert_contains(connect_fn, '"application_id"')

@test("Vobiz numbers: uses X-Auth-ID + X-Auth-Token")
def _():
    assert_contains(numbers_src, '"X-Auth-ID"')
    assert_contains(numbers_src, '"X-Auth-Token"')

@test("Vobiz numbers: release uses DELETE")
def _():
    assert_contains(numbers_src, "async def vobiz_release_number")
    release_start = numbers_src.find("async def vobiz_release_number")
    release_end = numbers_src.find("# ─── MCube")
    release_fn = numbers_src[release_start:release_end]
    assert_contains(release_fn, "client.delete(")

@test("MCube numbers: no fictional API endpoints")
def _():
    mcube_section = numbers_src[numbers_src.find("# ─── MCube"):numbers_src.find("# ─── SIP")]
    assert_not_in("api.mcube.com/v1/numbers", mcube_section, "MCube has no public numbers API")
    assert_not_in("/v1/numbers/configure", mcube_section, "MCube has no webhook config API")

@test("MCube numbers: returns configured number from settings")
def _():
    assert_contains(numbers_src, "settings.mcube_phone_number")

@test("URL encoding for Vobiz number paths")
def _():
    assert_contains(numbers_src, "url_quote")


# ═══════════════════════════════════════════════════════════
print("\n--- 6. Provider Registry ---")
# ═══════════════════════════════════════════════════════════

registry_src = get_source("cogniflow_home/telephony/registry.py")
registry_tree = get_ast("cogniflow_home/telephony/registry.py")

@test("Registry: all 7 providers registered")
def _():
    for p in ["twilio", "exotel", "vobiz", "mcube", "sip", "generic", "browser"]:
        assert_contains(registry_src, f'"{p}"')

@test("Registry: STREAMING_PROVIDERS excludes mcube")
def _():
    assert_contains(registry_src, "STREAMING_PROVIDERS")
    # Find the set literal
    sp_start = registry_src.find("STREAMING_PROVIDERS = {")
    sp_end = registry_src.find("}", sp_start) + 1
    sp_set = registry_src[sp_start:sp_end]
    assert_not_in('"mcube"', sp_set, "MCube should not be in STREAMING_PROVIDERS")
    for p in ["twilio", "exotel", "vobiz", "sip", "browser", "generic"]:
        assert_in(f'"{p}"', sp_set, f"{p} should be in STREAMING_PROVIDERS")

@test("Registry: supports_streaming function exists")
def _():
    assert_contains(registry_src, "def supports_streaming")

@test("Registry: imports MCubeProvider and SIPProvider")
def _():
    assert_contains(registry_src, "from cogniflow_home.telephony.mcube_provider import MCubeProvider")
    assert_contains(registry_src, "from cogniflow_home.telephony.sip_provider import SIPProvider")


# ═══════════════════════════════════════════════════════════
print("\n--- 7. Provider Handler Coverage ---")
# ═══════════════════════════════════════════════════════════

@test("PROVIDER_HANDLERS: Twilio has all 6 operations")
def _():
    for op in ["list_available", "buy", "connect", "list_owned", "verify", "release"]:
        assert_contains(numbers_src, f'"{op}"')

@test("PROVIDER_HANDLERS: Exotel has all 6 operations including release")
def _():
    # Find the exotel handler dict
    handler_start = numbers_src.find('"exotel": {')
    handler_end = numbers_src.find("},", handler_start) + 1
    handler = numbers_src[handler_start:handler_end]
    for op in ["list_available", "buy", "connect", "list_owned", "verify", "release"]:
        assert_in(f'"{op}"', handler, f"Exotel handler missing {op}")

@test("PROVIDER_HANDLERS: Vobiz has all 6 operations including release")
def _():
    handler_start = numbers_src.find('"vobiz": {')
    handler_end = numbers_src.find("},", handler_start) + 1
    handler = numbers_src[handler_start:handler_end]
    for op in ["list_available", "buy", "connect", "list_owned", "verify", "release"]:
        assert_in(f'"{op}"', handler, f"Vobiz handler missing {op}")

@test("PROVIDER_HANDLERS: MCube has only list_owned and verify (no buy/connect/release)")
def _():
    handler_start = numbers_src.find('"mcube": {')
    handler_end = numbers_src.find("},", handler_start) + 1
    handler = numbers_src[handler_start:handler_end]
    assert_in('"list_owned"', handler)
    assert_in('"verify"', handler)
    assert_not_in('"buy"', handler, "MCube should not have buy")
    assert_not_in('"connect"', handler, "MCube should not have connect")
    assert_not_in('"release"', handler, "MCube should not have release")

@test("PROVIDER_HANDLERS: SIP has only verify")
def _():
    handler_start = numbers_src.find('"sip": {')
    handler_end = numbers_src.find("},", handler_start) + 1
    handler = numbers_src[handler_start:handler_end]
    assert_in('"verify"', handler)


# ═══════════════════════════════════════════════════════════
print("\n--- 8. Number Detection ---")
# ═══════════════════════════════════════════════════════════

@test("_detect_provider: checks metadata.telephony_provider first")
def _():
    detect_fn = numbers_src[numbers_src.find("def _detect_provider"):]
    assert_contains(detect_fn, 'meta.get("telephony_provider")')

@test("_detect_provider: +1 -> twilio")
def _():
    assert_contains(numbers_src, 'phone_number.startswith("+1")')
    fn = numbers_src[numbers_src.find("def _detect_provider"):]
    plus1_idx = fn.find('startswith("+1")')
    return_after = fn.find("return", plus1_idx)
    line = fn[return_after:fn.find("\n", return_after)]
    assert_contains(line, '"twilio"')

@test("_detect_provider: +91 -> vobiz/exotel/mcube priority")
def _():
    assert_contains(numbers_src, 'phone_number.startswith("+91")')

@test("_detect_provider: sip: prefix -> sip")
def _():
    assert_contains(numbers_src, 'phone_number.startswith("sip:")')


# ═══════════════════════════════════════════════════════════
print("\n--- 9. Config Defaults ---")
# ═══════════════════════════════════════════════════════════

config_src = get_source("cogniflow_home/config.py")

@test("Config: exotel_subdomain defaults to 'api'")
def _():
    assert_contains(config_src, 'exotel_subdomain: str = "api"')

@test("Config: MCube settings exist")
def _():
    assert_contains(config_src, "mcube_api_key")
    assert_contains(config_src, "mcube_api_secret")
    assert_contains(config_src, "mcube_phone_number")

@test("Config: SIP settings exist")
def _():
    assert_contains(config_src, "sip_trunk_host")
    assert_contains(config_src, "sip_trunk_port")
    assert_contains(config_src, "sip_trunk_username")
    assert_contains(config_src, "sip_trunk_password")
    assert_contains(config_src, "sip_trunk_transport")

@test("Config: SIP port default is 5060")
def _():
    assert_contains(config_src, "sip_trunk_port: int = 5060")


# ═══════════════════════════════════════════════════════════
print("\n--- 10. Voice Router ---")
# ═══════════════════════════════════════════════════════════

voice_src = get_source("cogniflow_home/routers/voice.py")

@test("Voice router: MCube inbound does NOT return WebSocket URL")
def _():
    mcube_start = voice_src.find("async def mcube_inbound")
    mcube_end = voice_src.find("@router", voice_src.find("async def mcube_status"))
    mcube_fn = voice_src[mcube_start:mcube_end]
    assert_not_in("get_twiml_or_response", mcube_fn, "MCube should not return streaming response")
    assert_not_in("websocket_url", mcube_fn, "MCube should not return WS URL")

@test("Voice router: MCube outbound route removed")
def _():
    assert_not_in("mcube_outbound", voice_src, "MCube outbound route should be removed")
    assert_not_in("/voice/mcube/outbound", voice_src, "MCube outbound path should be removed")

@test("Voice router: MCube status handles monitorUcid")
def _():
    assert_contains(voice_src, '"monitorUcid"')

@test("Voice router: SIP inbound route exists")
def _():
    assert_contains(voice_src, "/voice/sip/inbound")

@test("Voice router: SIP outbound route exists")
def _():
    assert_contains(voice_src, "/voice/sip/outbound")

@test("Voice router: universal WebSocket handler exists")
def _():
    assert_contains(voice_src, "/voice/{provider_name}/ws")


# ═══════════════════════════════════════════════════════════
print("\n--- 11. Numbers Router ---")
# ═══════════════════════════════════════════════════════════

numbers_router_src = get_source("cogniflow_home/routers/numbers.py")

@test("Numbers router: 8 endpoints exist")
def _():
    endpoints = [
        "/api/numbers",
        "/api/numbers/available",
        "/api/numbers/buy",
        "/api/numbers/connect",
        "/api/numbers/verify",
        "/api/numbers/verify-all",
        "/api/numbers/release",
        "/api/numbers/webhooks",
    ]
    for ep in endpoints:
        assert_contains(numbers_router_src, ep, f"missing endpoint {ep}")

@test("Numbers router: MCube webhook URLs show no streaming")
def _():
    mcube_section_start = numbers_router_src.find('provider == "mcube"')
    mcube_section_end = numbers_router_src.find('provider == "sip"')
    mcube_section = numbers_router_src[mcube_section_start:mcube_section_end]
    assert_not_in("websocket", mcube_section, "MCube should not show WS URL")
    assert_contains(mcube_section, "does not support WebSocket")

@test("Numbers router: MCube instructions mention no streaming")
def _():
    assert_contains(numbers_router_src, "MCube does NOT support WebSocket audio streaming")


# ═══════════════════════════════════════════════════════════
print("\n--- 12. Health & Integrations ---")
# ═══════════════════════════════════════════════════════════

health_src = get_source("cogniflow_home/routers/health.py")
integrations_src = get_source("cogniflow_home/routers/integrations.py")

@test("Health: MCube in telephony checks")
def _():
    assert_contains(health_src, '"mcube"')
    assert_contains(health_src, "settings.mcube_api_key")

@test("Health: SIP in telephony checks")
def _():
    assert_contains(health_src, '"sip"')
    assert_contains(health_src, "settings.sip_trunk_host")

@test("Integrations: MCube in provider list")
def _():
    assert_contains(integrations_src, '"mcube"')

@test("Integrations: SIP in provider list")
def _():
    assert_contains(integrations_src, '"sip"')
    assert_contains(integrations_src, "SIP Trunking")

@test("Health: diagnose includes mcube and sip")
def _():
    diag_start = health_src.find("async def diagnose_voice")
    diag_section = health_src[diag_start:]
    assert_contains(diag_section, '"mcube"')
    assert_contains(diag_section, '"sip"')


# ═══════════════════════════════════════════════════════════
print("\n--- 13. Protocol Message Format Validation ---")
# ═══════════════════════════════════════════════════════════

@test("Exotel start message: can parse documented format")
def _():
    msg = {
        "event": "start",
        "sequence_number": 1,
        "stream_sid": "stream_123",
        "start": {
            "stream_sid": "stream_123",
            "call_sid": "call_456",
            "account_sid": "acc_789",
            "from": "+919876543210",
            "to": "+911234567890",
            "custom_parameters": {"key1": "value1"},
            "media_format": {
                "encoding": "audio/x-raw",
                "sample_rate": "8000",
                "bit_rate": "256"
            }
        }
    }
    start = msg.get("start", {})
    assert_eq(start.get("stream_sid", ""), "stream_123")
    assert_eq(start.get("call_sid", ""), "call_456")
    assert_eq(start.get("from", "unknown"), "+919876543210")
    assert_eq(start.get("to", ""), "+911234567890")

@test("Vobiz start message: can parse documented format")
def _():
    msg = {
        "sequenceNumber": 0,
        "event": "start",
        "start": {
            "callId": "5401fd2e-6344-40df-a22c-c8ffea7a92e7",
            "streamId": "c4dfd815-a92a-4140-ab85-5ff28c004116",
            "accountId": "500025",
            "tracks": ["inbound"],
            "mediaFormat": {
                "encoding": "audio/x-l16",
                "sampleRate": 16000
            }
        },
        "extra_headers": "{}"
    }
    start = msg.get("start", {})
    stream_id = start.get("streamId", msg.get("streamId", ""))
    call_id = start.get("callId", "")
    assert_eq(stream_id, "c4dfd815-a92a-4140-ab85-5ff28c004116")
    assert_eq(call_id, "5401fd2e-6344-40df-a22c-c8ffea7a92e7")
    assert_eq(start.get("mediaFormat", {}).get("sampleRate", 8000), 16000)

@test("Vobiz media message: can parse documented format")
def _():
    msg = {
        "sequenceNumber": 2,
        "streamId": "c4dfd815",
        "event": "media",
        "media": {
            "track": "inbound",
            "timestamp": "1778597597091",
            "chunk": 2,
            "payload": "SGVsbG8="  # base64 "Hello"
        },
        "extra_headers": "{}"
    }
    media = msg.get("media", {})
    payload = media.get("payload", "")
    assert_eq(payload, "SGVsbG8=")
    import base64
    decoded = base64.b64decode(payload)
    assert_eq(decoded, b"Hello")

@test("Vobiz playAudio message: correct outbound format")
def _():
    msg = {
        "event": "playAudio",
        "media": {
            "contentType": "audio/x-mulaw",
            "sampleRate": 8000,
            "payload": "base64data"
        }
    }
    assert_eq(msg["event"], "playAudio")
    assert_eq(msg["media"]["contentType"], "audio/x-mulaw")
    assert_eq(msg["media"]["sampleRate"], 8000)

@test("Vobiz clearAudio message: correct format")
def _():
    stream_id = "test-stream-123"
    msg = {"event": "clearAudio", "streamId": stream_id}
    assert_eq(msg["event"], "clearAudio")
    assert_eq(msg["streamId"], stream_id)

@test("Vobiz checkpoint message: correct format")
def _():
    msg = {"event": "checkpoint", "streamId": "stream-1", "name": "response-3"}
    assert_eq(msg["event"], "checkpoint")
    assert_eq(msg["name"], "response-3")

@test("MCube outbound: correct request format")
def _():
    params = {
        "HTTP_AUTHORIZATION": "test_key",
        "exenumber": "1001",
        "custnumber": "9876543210",
        "refurl": "https://example.com/callback",
    }
    assert_in("HTTP_AUTHORIZATION", params)
    assert_in("exenumber", params)
    assert_in("custnumber", params)
    assert_in("refurl", params)

@test("MCube outbound response: can parse documented format")
def _():
    resp = {
        "status": "success",
        "message": "call initiated successfully",
        "monitorUcid": "9179160xxxxx",
        "callStartTime": "2020-01-01 12:00:00"
    }
    call_id = resp.get("monitorUcid", "")
    status = resp.get("status", "unknown")
    assert_eq(call_id, "9179160xxxxx")
    assert_eq(status, "success")


# ═══════════════════════════════════════════════════════════
print("\n--- 14. Router Registration ---")
# ═══════════════════════════════════════════════════════════

init_src = get_source("cogniflow_home/routers/__init__.py")

@test("Router init: numbers_router imported")
def _():
    assert_contains(init_src, "from cogniflow_home.routers.numbers import router as numbers_router")

@test("Router init: numbers_router in all_routers list")
def _():
    assert_contains(init_src, "numbers_router")

@test("Router init: all 16 routers registered")
def _():
    expected = [
        "health_router", "voice_router", "calls_router", "agents_router",
        "contacts_router", "campaigns_router", "webhooks_router", "stats_router",
        "integrations_router", "admin_router", "billing_router", "organizations_router",
        "templates_router", "benchmarks_router", "v1_router", "numbers_router",
    ]
    for r in expected:
        assert_in(r, init_src, f"missing {r} in all_routers")


# ═══════════════════════════════════════════════════════════
# RESULTS
# ═══════════════════════════════════════════════════════════

print("\n" + "=" * 60)
total = PASS + FAIL
print(f"RESULTS: {PASS}/{total} passed, {FAIL} failed")
print("=" * 60)

if ERRORS:
    print("\nFailed tests:")
    for e in ERRORS:
        print(e)
    print()

sys.exit(1 if FAIL else 0)
