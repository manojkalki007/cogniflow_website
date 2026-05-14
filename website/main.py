import json
import logging
import sys
from datetime import datetime, timezone

import uvicorn
from dotenv import load_dotenv

load_dotenv()


class JSONFormatter(logging.Formatter):
    def format(self, record):
        log = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info and record.exc_info[0]:
            log["exception"] = self.formatException(record.exc_info)
        return json.dumps(log)


from cogniflow_home.config import settings  # noqa: E402

if settings.debug:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(name)-20s %(levelname)-5s %(message)s",
    )
else:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())
    logging.basicConfig(level=logging.INFO, handlers=[handler])

if __name__ == "__main__":
    uvicorn.run(
        "cogniflow_home.server:app",
        host=settings.server_host,
        port=settings.server_port,
        reload=settings.debug,
    )
