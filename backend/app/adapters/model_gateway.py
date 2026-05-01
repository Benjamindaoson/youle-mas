"""统一模型网关 — 业务代码只调 capability_id，不直接 import SDK。

支持 4 种能力：text / image / tts / music。
每种能力有主选模型和工程 fallback，任一 API 失败不崩溃。
实现 async context manager 协议，确保 httpx 客户端正确关闭。
"""
from __future__ import annotations

import base64
import json
import time
from types import TracebackType

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import Settings
from app.errors import GatewayError
from app.logging_config import logger


class ModelGateway:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._client: httpx.AsyncClient | None = None

    async def __aenter__(self) -> ModelGateway:
        self._client = httpx.AsyncClient(timeout=30.0)
        return self

    async def __aexit__(self, exc_type: type | None, exc: BaseException | None, tb: TracebackType | None) -> None:
        await self.close()

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=30.0)
        return self._client

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def text(self, capability_id: str, payload: dict) -> dict:
        t0 = time.monotonic()
        news_items = payload.get("news_items", [])

        if self.settings.has_deepseek:
            try:
                result = await self._call_deepseek(payload)
                logger.info("model_call", capability=capability_id, status="ok",
                            latency_ms=int((time.monotonic() - t0) * 1000))
                return result
            except Exception as e:
                logger.warning("model_call_failed", capability=capability_id, error=str(e))

        script = self._template_script(news_items)
        logger.info("model_call", capability=capability_id, status="fallback",
                     latency_ms=int((time.monotonic() - t0) * 1000))
        return script

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, max=8))
    async def _call_deepseek(self, payload: dict) -> dict:
        client = await self._get_client()
        news_items = payload.get("news_items", [])

        def _field(item: object, name: str) -> str:
            # 统一兼容 dict / pydantic 对象，避免 getattr 在 dict 上静默返回空串
            if isinstance(item, dict):
                return str(item.get(name, "") or "")
            return str(getattr(item, name, "") or "")

        news_text = "\n".join(
            f"{i+1}. {_field(n, 'title')}（涉案金额：{_field(n, 'amount')}）- {_field(n, 'summary')}"
            for i, n in enumerate(news_items)
        )
        prompt = (
            "你是反诈短视频脚本专家。请根据以下新闻写一个60秒口播稿。\n"
            '输出JSON格式：{"hook":"开头3秒抓人句","body":["新闻1口播","新闻2口播",...],'
            '"closing":"结尾警示","estimated_duration_seconds":60,'
            '"evidence":[{"news_idx":1,"amount":"...","source":"..."}]}\n\n'
            f"新闻列表：\n{news_text}\n\n要求：严肃警示风格，不编造数据，每条约25-30字。"
        )
        resp = await client.post(
            f"{self.settings.DEEPSEEK_API_BASE}/chat/completions",
            headers={"Authorization": f"Bearer {self.settings.DEEPSEEK_API_KEY}"},
            json={
                "model": self.settings.DEEPSEEK_MODEL_PRO,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.7,
                "response_format": {"type": "json_object"},
            },
        )
        resp.raise_for_status()
        try:
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
        except (json.JSONDecodeError, KeyError, IndexError, ValueError) as e:
            # 上游返回非预期结构：记录并抛出，让 text() 走模板兜底
            preview = (resp.text or "")[:200]
            logger.warning("deepseek_bad_envelope", error=str(e), preview=preview)
            raise GatewayError(f"DeepSeek envelope malformed: {e}") from e
        try:
            return json.loads(content)
        except json.JSONDecodeError as e:
            preview = (content or "")[:200]
            logger.warning("deepseek_bad_json", error=str(e), preview=preview)
            raise GatewayError(f"DeepSeek content not JSON: {e}") from e

    def _template_script(self, news_items: list) -> dict:
        body: list[str] = []
        evidence: list[dict] = []
        for item in news_items[:10]:
            if isinstance(item, dict):
                title = item.get("title", "")
                amount = item.get("amount", "")
                idx = item.get("idx", len(body) + 1)
            else:
                title = getattr(item, "title", "")
                amount = getattr(item, "amount", "")
                idx = getattr(item, "idx", len(body) + 1)
            line = f"{title}，涉案金额{amount}" if amount else title
            body.append(line[:60])
            if amount:
                evidence.append({"news_idx": idx, "amount": amount, "source": "Excel"})

        return {
            "hook": "你的钱正在被盯上！最新十大网络诈骗案件曝光",
            "body": body or ["暂无新闻数据"],
            "closing": "天上不会掉馅饼，转账前请三思。关注反诈中心，守护你的钱袋子！",
            "estimated_duration_seconds": 60,
            "evidence": evidence,
        }

    def fallback_script(self, news_items: list | None = None) -> dict:
        return self._template_script(news_items or [])

    async def image(self, capability_id: str, payload: dict) -> str | None:
        if not self.settings.has_siliconflow:
            return None
        t0 = time.monotonic()
        try:
            client = await self._get_client()
            resp = await client.post(
                f"{self.settings.SILICONFLOW_API_BASE}/images/generations",
                headers={"Authorization": f"Bearer {self.settings.SILICONFLOW_API_KEY}"},
                json={
                    "model": self.settings.IMAGE_MODEL,
                    "prompt": payload.get("prompt", "warning poster"),
                    "n": 1, "size": "1024x1024",
                },
            )
            resp.raise_for_status()
            url = resp.json()["data"][0].get("url")
            logger.info("model_call", capability=capability_id, status="ok",
                         latency_ms=int((time.monotonic() - t0) * 1000))
            return url
        except Exception as e:
            logger.warning("model_call_failed", capability=capability_id, error=str(e))
            return None

    async def tts(self, capability_id: str, payload: dict) -> bytes | None:
        if not self.settings.has_minimax:
            return None
        t0 = time.monotonic()
        try:
            client = await self._get_client()
            resp = await client.post(
                f"https://api.minimax.chat/v1/t2a_v2?GroupId={self.settings.MINIMAX_GROUP_ID}",
                headers={
                    "Authorization": f"Bearer {self.settings.MINIMAX_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.settings.MINIMAX_TTS_MODEL,
                    "text": payload.get("text", ""),
                    "voice_setting": {
                        "voice_id": payload.get("voice", self.settings.MINIMAX_VOICE_ID),
                        "speed": payload.get("speed", 1.0),
                    },
                },
            )
            resp.raise_for_status()
            data = resp.json()
            if "data" in data and "audio" in data["data"]:
                audio_bytes = base64.b64decode(data["data"]["audio"])
                logger.info("model_call", capability=capability_id, status="ok",
                             latency_ms=int((time.monotonic() - t0) * 1000))
                return audio_bytes
            return None
        except Exception as e:
            logger.warning("model_call_failed", capability=capability_id, error=str(e))
            return None

    async def music(self, capability_id: str, payload: dict) -> None:
        return None
