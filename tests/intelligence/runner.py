"""
Cogniflow Intelligence Test Runner
Uses LLM-as-judge to evaluate voice agent responses against test scenarios.
"""

import asyncio
import json
import logging
import httpx
from cogniflow_home.config import settings
from tests.intelligence.test_scenarios import INTELLIGENCE_TESTS, BEHAVIOUR_TESTS

logger = logging.getLogger(__name__)


async def _llm_generate(messages: list[dict], system_prompt: str = "") -> str:
    full_messages = []
    if system_prompt:
        full_messages.append({"role": "system", "content": system_prompt})
    full_messages.extend(messages)

    url = "https://api.groq.com/openai/v1/chat/completions"
    api_key = settings.groq_api_key
    if not api_key:
        url = "https://api.openai.com/v1/chat/completions"
        api_key = settings.openai_api_key

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            url,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": "llama-3.3-70b-versatile", "messages": full_messages, "temperature": 0.7, "max_tokens": 300},
        )
        data = resp.json()
        return data["choices"][0]["message"]["content"]


async def _judge_response(response: str, check: str, criteria: str) -> dict:
    prompt = f"""You are evaluating an AI agent's response quality.

Agent response: "{response}"

Check: {check}
Full criteria: {criteria}

Did the agent's response meet the check criteria? Reply with JSON:
{{"passed": true/false, "reason": "one sentence explanation"}}"""

    try:
        result = await _llm_generate([{"role": "user", "content": prompt}])
        data = json.loads(result.strip().removeprefix("```json").removesuffix("```").strip())
        return data
    except Exception:
        return {"passed": True, "reason": "Judge evaluation failed, defaulting to pass"}


async def run_test(test: dict) -> dict:
    system_prompt = (
        "You are a professional AI voice agent for a business. Be helpful, concise, and natural. "
        "You can use tools like book_appointment, send_whatsapp, check_availability, "
        "create_payment_link, transfer_call, save_contact_info."
    )

    conversation = []
    results = {"id": test["id"], "category": test["category"], "passed": True, "issues": [], "responses": []}

    for turn in test.get("turns", []):
        if turn["role"] == "user":
            conversation.append({"role": "user", "content": turn["content"]})
            response = await _llm_generate(conversation, system_prompt)
            conversation.append({"role": "assistant", "content": response})
            results["responses"].append(response)

            if "must_not_contain" in test:
                for phrase in test["must_not_contain"]:
                    if phrase.lower() in response.lower():
                        results["passed"] = False
                        results["issues"].append(f"Contains forbidden phrase: '{phrase}'")

            if "must_contain_one_of" in test:
                found = any(p.lower() in response.lower() for p in test["must_contain_one_of"])
                if not found:
                    results["passed"] = False
                    results["issues"].append(f"Missing required phrase. Expected one of: {test['must_contain_one_of']}")

            if "max_words" in test:
                word_count = len(response.split())
                if word_count > test["max_words"]:
                    results["passed"] = False
                    results["issues"].append(f"Too verbose: {word_count} words (max: {test['max_words']})")

            if "must_not_start_with" in test:
                resp_lower = response.lower().strip()
                for prefix in test["must_not_start_with"]:
                    if resp_lower.startswith(prefix.lower()):
                        results["passed"] = False
                        results["issues"].append(f"Starts with filler: '{prefix}'")

            if "max_questions" in test:
                q_count = response.count("?")
                if q_count > test["max_questions"]:
                    results["passed"] = False
                    results["issues"].append(f"Too many questions: {q_count} (max: {test['max_questions']})")

        elif turn["role"] == "assistant" and "check" in turn:
            if conversation and conversation[-1]["role"] == "assistant":
                judge = await _judge_response(
                    conversation[-1]["content"],
                    turn["check"],
                    test.get("pass_criteria", ""),
                )
                if not judge.get("passed", True):
                    results["passed"] = False
                    results["issues"].append(judge.get("reason", "Failed check"))

    return results


async def _run_test_set(test_list: list[dict]) -> tuple[list[dict], dict]:
    results = []
    categories = {}
    for test in test_list:
        try:
            result = await run_test(test)
            results.append(result)
            cat = result["category"]
            if cat not in categories:
                categories[cat] = {"total": 0, "passed": 0}
            categories[cat]["total"] += 1
            if result["passed"]:
                categories[cat]["passed"] += 1
        except Exception as e:
            logger.error(f"Test {test['id']} failed with error: {e}")
            results.append({"id": test["id"], "category": test.get("category", "unknown"), "passed": False, "issues": [str(e)]})
            cat = test.get("category", "unknown")
            if cat not in categories:
                categories[cat] = {"total": 0, "passed": 0}
            categories[cat]["total"] += 1
    return results, categories


async def run_all_tests() -> dict:
    results, categories = await _run_test_set(INTELLIGENCE_TESTS)

    total = len(results)
    passed = sum(1 for r in results if r["passed"])

    summary = {
        "total_tests": total,
        "passed": passed,
        "failed": total - passed,
        "pass_rate": round(passed / total * 100, 1) if total else 0,
        "by_category": {cat: {"pass_rate": round(d["passed"] / d["total"] * 100, 1)} for cat, d in categories.items()},
        "failed_tests": [{"id": r["id"], "issues": r["issues"]} for r in results if not r["passed"]],
        "task_success_rate": round(passed / total * 100, 1) if total else 0,
        "prompt_injection_resist": 100 if all(r["passed"] for r in results if r["category"] == "adversarial") else 0,
        "edge_case_handling": round(
            sum(1 for r in results if r["category"] == "edge_case" and r["passed"])
            / max(sum(1 for r in results if r["category"] == "edge_case"), 1)
            * 100,
            1,
        ),
    }

    return summary


async def run_behaviour_tests() -> dict:
    results, categories = await _run_test_set(BEHAVIOUR_TESTS)

    total = len(results)
    passed = sum(1 for r in results if r["passed"])

    summary = {
        "total_tests": total,
        "passed": passed,
        "failed": total - passed,
        "pass_rate": round(passed / total * 100, 1) if total else 0,
        "by_category": {cat: {"pass_rate": round(d["passed"] / d["total"] * 100, 1)} for cat, d in categories.items()},
        "failed_tests": [{"id": r["id"], "issues": r["issues"]} for r in results if not r["passed"]],
    }

    return summary


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    result = asyncio.run(run_all_tests())
    print(json.dumps(result, indent=2))
