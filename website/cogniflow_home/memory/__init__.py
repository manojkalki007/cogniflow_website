from cogniflow_home.events import bus
from cogniflow_home.memory.caller_memory import caller_memory

import logging

logger = logging.getLogger(__name__)


def register():
    bus.on("call.completed", _update_memory)
    logger.info("Caller memory registered")


async def _update_memory(event: str, data: dict):
    phone = data.get("caller_number")
    summary = data.get("summary", "")
    if phone:
        await caller_memory.update_after_call(phone, summary)
