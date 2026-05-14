"""
Event bus for call lifecycle events.

Any module can subscribe to events. This is the extension point for:
- Call logging (Supabase)
- CRM sync (HubSpot)
- Webhooks (external)
- Analytics (future)
- Campaign tracking (future)

Events:
  call.started    — a call has connected and the agent is ready
  call.completed  — a call has ended, transcript is available
  call.failed     — a call failed to connect or errored
  contact.created — a new contact was auto-created
  contact.updated — an existing contact was updated
"""

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any, Callable, Awaitable

logger = logging.getLogger("cogniflow_home.events")

EventHandler = Callable[[str, dict[str, Any]], Awaitable[None]]


class EventBus:
    def __init__(self):
        self._handlers: dict[str, list[EventHandler]] = {}

    def on(self, event: str, handler: EventHandler):
        self._handlers.setdefault(event, []).append(handler)

    def off(self, event: str, handler: EventHandler):
        if event in self._handlers:
            self._handlers[event] = [h for h in self._handlers[event] if h != handler]

    async def emit(self, event: str, data: dict[str, Any]):
        handlers = self._handlers.get(event, []) + self._handlers.get("*", [])
        for handler in handlers:
            try:
                await handler(event, data)
            except Exception:
                logger.exception(f"Event handler error for {event}")


bus = EventBus()
