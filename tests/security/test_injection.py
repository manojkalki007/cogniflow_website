"""Security tests for SOQL injection prevention in Salesforce integration.

The salesforce module imports from config and events, which depend on
pydantic_settings and other external packages. We mock the entire chain.
"""

import sys
from unittest.mock import MagicMock

# Mock external dependency chain BEFORE importing the module under test.
sys.modules.setdefault("pydantic_settings", MagicMock())
sys.modules.setdefault("httpx", MagicMock())
sys.modules.setdefault("cogniflow_home.config", MagicMock())
_mock_config = sys.modules["cogniflow_home.config"]
_mock_config.settings = MagicMock()
_mock_config.settings.salesforce_client_id = ""
sys.modules.setdefault("cogniflow_home.db", MagicMock())
sys.modules.setdefault("cogniflow_home.db.supabase", MagicMock())
sys.modules.setdefault("cogniflow_home.events", MagicMock())

from cogniflow_home.integrations.salesforce import SalesforceIntegration  # noqa: E402


class TestSoqlEscape:
    def test_escapes_single_quote(self):
        result = SalesforceIntegration._escape_soql("test'value")
        assert "'" not in result or "\\'" in result
        assert result == "test\\'value"

    def test_escapes_backslash(self):
        result = SalesforceIntegration._escape_soql("test\\value")
        assert result == "test\\\\value"


class TestPhoneValidation:
    def test_rejects_sql_injection_in_phone(self):
        sfdc = SalesforceIntegration()
        # _sanitize_phone strips non-phone chars, then fullmatch rejects
        clean = sfdc._sanitize_phone("'; DROP TABLE--")
        # After sanitization: only digits, +, spaces, hyphens, parens remain
        # "'; DROP TABLE--" -> "" (no valid phone chars except maybe spaces)
        import re
        valid = bool(clean and re.fullmatch(r"[\d+\s\-()]{7,20}", clean))
        assert not valid, (
            f"Malicious input should be rejected, but got clean='{clean}'"
        )
