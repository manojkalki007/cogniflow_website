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


razorpay = RazorpayIntegration()
