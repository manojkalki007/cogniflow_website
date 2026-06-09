"""API router registry — import all sub-routers for inclusion in the app."""

from cogniflow_home.routers.health import router as health_router
from cogniflow_home.routers.voice import router as voice_router
from cogniflow_home.routers.calls import router as calls_router
from cogniflow_home.routers.agents import router as agents_router
from cogniflow_home.routers.contacts import router as contacts_router
from cogniflow_home.routers.campaigns import router as campaigns_router
from cogniflow_home.routers.webhooks import router as webhooks_router
from cogniflow_home.routers.stats import router as stats_router
from cogniflow_home.routers.integrations import router as integrations_router
from cogniflow_home.routers.admin import router as admin_router
from cogniflow_home.routers.billing import router as billing_router
from cogniflow_home.routers.organizations import router as organizations_router
from cogniflow_home.routers.templates import router as templates_router
from cogniflow_home.routers.benchmarks import router as benchmarks_router
from cogniflow_home.routers.v1 import router as v1_router
from cogniflow_home.routers.numbers import router as numbers_router
from cogniflow_home.routers.callbacks import router as callbacks_router

all_routers = [
    health_router,
    voice_router,
    calls_router,
    agents_router,
    contacts_router,
    campaigns_router,
    webhooks_router,
    stats_router,
    integrations_router,
    admin_router,
    billing_router,
    organizations_router,
    templates_router,
    benchmarks_router,
    v1_router,
    numbers_router,
    callbacks_router,
]
