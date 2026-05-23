"""
Razorpay integration — generate payment links during live calls.
"""

import logging
import time

import httpx

from cogniflow_home.config import settings

logger = logging.getLogger(__name__)


class RazorpayIntegration:
    BASE_URL = "https://api.razorpay.com/v1"

    def __init__(self):
        self.key_id = settings.razorpay_key_id
        self.key_secret = settings.razorpay_key_secret

    async def create_payment_link(
        self,
        amount_inr: float,
        description: str,
        customer_name: str = None,
        customer_phone: str = None,
        customer_email: str = None,
        expire_minutes: int = 60,
    ) -> dict:
        payload = {
            "amount": int(amount_inr * 100),
            "currency": "INR",
            "description": description,
            "expire_by": int(time.time()) + (expire_minutes * 60),
            "notify": {"sms": bool(customer_phone), "email": bool(customer_email)},
        }
        if customer_name or customer_phone or customer_email:
            payload["customer"] = {}
            if customer_name:
                payload["customer"]["name"] = customer_name
            if customer_phone:
                payload["customer"]["contact"] = customer_phone
            if customer_email:
                payload["customer"]["email"] = customer_email

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{self.BASE_URL}/payment_links",
                auth=(self.key_id, self.key_secret),
                json=payload,
            )
            data = resp.json()
            return {
                "payment_link_id": data.get("id"),
                "short_url": data.get("short_url"),
                "amount": amount_inr,
                "status": data.get("status"),
            }


    async def create_subscription(self, tenant_id: str, plan_id: str, email: str = None) -> dict:
        """Create a Razorpay subscription for a tenant."""
        PLAN_MAP = {
            "starter": settings.razorpay_plan_starter,
            "growth": settings.razorpay_plan_growth,
        }
        rzp_plan_id = PLAN_MAP.get(plan_id)
        if not rzp_plan_id:
            raise ValueError(f"Unknown plan: {plan_id}")

        payload = {
            "plan_id": rzp_plan_id,
            "total_count": 12,
            "quantity": 1,
            "notes": {"tenant_id": tenant_id, "plan": plan_id},
        }
        if email:
            payload["notify_info"] = {"notify_email": email}

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{self.BASE_URL}/subscriptions",
                auth=(self.key_id, self.key_secret),
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            return {
                "subscription_id": data["id"],
                "short_url": data.get("short_url"),
                "status": data.get("status"),
            }

    async def verify_signature(self, payload_bytes: bytes, signature: str) -> bool:
        """Verify Razorpay webhook signature against raw request body bytes."""
        if not settings.razorpay_webhook_secret:
            return False
        import hmac
        import hashlib
        expected = hmac.new(
            settings.razorpay_webhook_secret.encode(),
            payload_bytes,
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, signature)


razorpay = RazorpayIntegration()
