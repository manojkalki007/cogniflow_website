from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # STT
    deepgram_api_key: str = ""

    # LLM
    groq_api_key: str = ""

    # Embeddings (used by knowledge base RAG)
    openai_api_key: str = ""

    # TTS

    # Twilio
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""

    # Exotel
    exotel_api_key: str = ""
    exotel_api_token: str = ""
    exotel_account_sid: str = ""
    exotel_subdomain: str = ""
    exotel_caller_id: str = ""

    # Vobiz (India)
    vobiz_auth_id: str = ""
    vobiz_auth_token: str = ""
    vobiz_phone_number: str = ""

    # Supabase
    supabase_url: str = ""
    supabase_key: str = ""
    supabase_jwt_secret: str = ""

    # Admin
    admin_emails: list[str] = []

    # HubSpot
    hubspot_api_key: str = ""

    # WhatsApp Business API
    whatsapp_api_key: str = ""
    whatsapp_api_url: str = "https://graph.facebook.com/v18.0"

    # Webhooks
    webhook_secret: str = ""

    # Server
    server_host: str = "0.0.0.0"
    server_port: int = 8000
    public_url: str = "https://your-domain.com"
    api_secret_key: str = ""
    cors_origins: list[str] = [
        "http://localhost:3000",
        "https://home.cogniflowautomations.com",
        "https://cogniflowautomations.com",
        "https://www.cogniflowautomations.com",
    ]
    debug: bool = False
    max_concurrent_calls: int = 50
    redis_url: str = ""  # Optional, for horizontal scaling

    # Sarvam AI (Indian languages)
    sarvam_api_key: str = ""

    # Smallest AI
    smallest_ai_api_key: str = ""

    # ElevenLabs (premium TTS)
    elevenlabs_api_key: str = ""
    elevenlabs_model: str = "eleven_turbo_v2_5"

    # Salesforce
    salesforce_client_id: str = ""
    salesforce_client_secret: str = ""
    salesforce_username: str = ""
    salesforce_password: str = ""

    # Google Calendar
    google_calendar_id: str = "primary"
    google_service_account_json: str = ""
    google_service_account_path: str = ""

    # Razorpay
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""

    # SMTP (Email)
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = "no_reply@cogniflowautomations.com"
    smtp_from_name: str = "Cogniflow"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
