"""V agent — 视频能力（含音频）。

V0 的 audio_agent + video_agent 在 V1 合并到这里。音频是视频组成部分，
不再单独成 capability。

Phase 3 实现：
- 给定脚本（hook/body/closing），调 TTS（无 key → 静音）
- BGM 从本地选（无文件 → 静音）
- audio_normalizer 统一音频格式（无 ffmpeg → 跳过）
- subtitle_maker 出 srt
- ffmpeg_composer 把图片 + 音频 + 字幕合成 mp4（无 ffmpeg → JPG fallback）
- thumbnail_maker 出封面

如果上游没给完整脚本（subject 即可），用一句简单 placeholder 跑通；保持
和 anti_scam_video runner 同样的 fallback 哲学。

详见 docs/v1-architecture.md §4.4 + 附录 B。
"""
from __future__ import annotations

import json
import os
import re
from collections.abc import AsyncIterator
from typing import Any, TYPE_CHECKING

from app.adapters.model_gateway import ModelGateway
from app.adapters.tools.audio_normalizer import normalize_audio
from app.adapters.tools.ffmpeg_composer import compose_news_video
from app.adapters.tools.local_bgm import select_bgm
from app.adapters.tools.silent_audio import create_silent
from app.adapters.tools.subtitle_maker import script_to_srt
from app.adapters.tools.thumbnail_maker import create_thumbnail
from app.adapters.tools.tts_client import tts_minimax
from app.config import settings

from app.errors import FFmpegError
from app.logging_config import logger
from app.skills.registry import SkillStep



if TYPE_CHECKING:
    from app.conductor.intent import Intent

def _safe(sid: str) -> str:
    s = re.sub(r"[^\w\-]", "_", sid or "")
    return re.sub(r"_+", "_", s).strip("_") or "default"


def _video_dir(session_id: str) -> str:
    base = os.path.join(settings.ARTIFACT_DIR, _safe(session_id), "video")
    os.makedirs(base, exist_ok=True)
    return base


def _audio_dir(session_id: str) -> str:
    base = os.path.join(settings.ARTIFACT_DIR, _safe(session_id), "audio")
    os.makedirs(base, exist_ok=True)
    return base


def _extract_script(intent: Intent, upstream: list[Any]) -> dict:
    """从上游 T agent 产出里找脚本 JSON；找不到就拿 intent.subject 拼最小脚本。"""
    for entry in upstream or []:
        for art in (entry.get("artifacts") or []):
            text = art.get("content_inline") or ""
            if not text:
                continue
            stripped = text.strip()
            if "{" in stripped and "}" in stripped:
                try:
                    s = stripped[stripped.index("{"): stripped.rindex("}") + 1]
                    obj = json.loads(s)
                    if isinstance(obj, dict) and ("hook" in obj or "body" in obj):
                        return obj
                except (json.JSONDecodeError, ValueError):
                    pass
    # fallback：用 subject 拼一份最小脚本，确保后续音视频流不空跑
    subj = intent.subject or "短视频内容"
    return {
        "hook": f"关于 {subj} 的内容",
        "body": [f"今天聊聊 {subj}"],
        "closing": "感谢观看",
        "estimated_duration_seconds": 30,
    }


def _extract_image_paths(upstream: list[Any]) -> list[str]:
    """从上游 I agent 产出里抽图片路径。"""
    paths: list[str] = []
    for entry in upstream or []:
        for art in (entry.get("artifacts") or []):
            if (art.get("artifact_type") or "").startswith("image"):
                fp = art.get("file_path")
                if fp and os.path.isfile(fp):
                    paths.append(fp)
    return paths


async def _produce_voice(text: str, save_dir: str, duration: int) -> str:
    """TTS 主路 + 静音兜底。"""
    if settings.has_minimax:
        async with ModelGateway(settings) as gw:
            path = await tts_minimax(
                text=text.strip(), voice=settings.MINIMAX_VOICE_ID,
                speed=1.05, save_dir=save_dir, gateway=gw)
        if path:
            return path
    return await create_silent(duration, save_dir)


async def _produce_bgm(save_dir: str, duration: int) -> str:
    bgm_path = select_bgm("serious_warning", settings.DEFAULT_BGM_PATH)
    if bgm_path:
        return bgm_path
    return await create_silent(duration, save_dir)


_REACT_KEYWORDS = ("看视频", "理解视频", "改视频", "审核视频", "分析视频",
                    "字幕提取", "scene", "review")


def _should_use_react(task: SkillStep, upstream: list[Any]) -> bool:
    """task 含理解关键词 + 上游有视频 + has_anthropic → ReAct；否则走合成路径。"""
    if not settings.has_anthropic:
        return False
    text = (task.task or "").lower()
    if not any(kw in text for kw in _REACT_KEYWORDS):
        return False
    for entry in upstream or []:
        for art in (entry.get("artifacts") or []):
            atype = (art.get("artifact_type") or "").lower()
            if atype.startswith("video") or atype.startswith("subtitle"):
                return True
    return False


async def run(
    task: SkillStep,
    intent: Intent,
    upstream: list[Any],
    session_id: str,
) -> AsyncIterator[dict]:
    """端到端跑一遍 video skill 的一个 step。

    两条路径：
    - **ReAct 理解/改视频**：上游有视频/字幕 + task 含理解关键词
    - **合成**（默认）：脚本 → TTS → BGM → 字幕 → FFmpeg mp4
    """
    if _should_use_react(task, upstream):
        try:
            async for ev in _react_loop(task=task, upstream=upstream,
                                         session_id=session_id):
                yield ev
            return
        except Exception as e:  # noqa: BLE001
            logger.warning("v_agent_react_failed_fallback_compose", error=str(e))
            # 失败回退到合成路径

    # 合成路径开始
    save = _video_dir(session_id)
    audio = _audio_dir(session_id)

    script = _extract_script(intent, upstream)
    duration = int(script.get("estimated_duration_seconds", 60) or 60)
    full_text = " ".join(filter(None, [
        script.get("hook", ""),
        " ".join(script.get("body", []) or []),
        script.get("closing", ""),
    ])).strip()

    yield {"type": "chunk", "capability": "V",
           "text": f"准备 {duration}s 视频：脚本 {len(full_text)} 字"}

    # 1. 音频部分（V0 audio_agent 合并进来）
    if not settings.has_minimax:
        yield {
            "type": "warning", "capability": "V",
            "message": "未配置 MINIMAX_API_KEY，将用静音占位 TTS",
        }
    voice_path = await _produce_voice(full_text or "占位音频", audio, duration)
    if not os.path.isfile(settings.DEFAULT_BGM_PATH):
        yield {
            "type": "warning", "capability": "V",
            "message": f"未找到 BGM 文件 ({settings.DEFAULT_BGM_PATH})，将用静音占位",
        }
    bgm_path = await _produce_bgm(audio, duration)
    voice_path = await normalize_audio(voice_path)
    bgm_path = await normalize_audio(bgm_path)

    yield {
        "type": "artifact", "capability": "V",
        "artifact_type": "voice", "title": "TTS 配音",
        "file_path": voice_path, "mime_type": "audio/wav",
        "session_id": session_id,
    }
    yield {
        "type": "artifact", "capability": "V",
        "artifact_type": "bgm", "title": "BGM",
        "file_path": bgm_path, "mime_type": "audio/wav",
        "session_id": session_id,
    }

    # 2. 字幕
    try:
        sub_path = await script_to_srt(script, audio_duration=duration, save_dir=save)
        yield {
            "type": "artifact", "capability": "V",
            "artifact_type": "subtitle", "title": "字幕",
            "file_path": sub_path, "mime_type": "text/srt",
            "session_id": session_id,
        }
    except Exception as e:  # noqa: BLE001
        logger.warning("v_agent_subtitle_failed", error=str(e))

    # 3. 合成 mp4（无 ffmpeg 走 fallback：把第一张图当成产出）
    images = _extract_image_paths(upstream)
    video_out = os.path.join(save, "video.mp4")
    has_mp4 = False
    compose_error: str | None = None
    if not images:
        yield {
            "type": "warning", "capability": "V",
            "message": "上游没有图片素材，无法合成 mp4，将用占位图代替",
        }
    elif not settings.ffmpeg_available:
        yield {
            "type": "warning", "capability": "V",
            "message": "本机找不到 ffmpeg，无法合成 mp4，将用第一张图代替",
        }
    if images and settings.ffmpeg_available:
        try:
            per_img = max(1.0, duration / max(len(images), 1))
            await compose_news_video(
                images=images, voice=voice_path, bgm=bgm_path,
                bgm_volume_db=-15.0, subtitles="",
                output=video_out, per_image_duration=per_img,
            )
            has_mp4 = os.path.isfile(video_out)
        except FFmpegError as e:
            logger.warning("v_agent_compose_failed_fallback", error=str(e))
            compose_error = str(e)
        except Exception as e:  # noqa: BLE001
            logger.warning("v_agent_compose_unexpected", error=str(e))
            compose_error = str(e)

    if has_mp4:
        yield {
            "type": "artifact", "capability": "V",
            "artifact_type": "video", "title": "合成视频",
            "file_path": video_out, "mime_type": "video/mp4",
            "session_id": session_id,
        }
    else:
        if compose_error:
            yield {
                "type": "warning", "capability": "V",
                "message": f"ffmpeg 合成失败（{compose_error}），降级为图片产出",
            }
        # fallback：标注 video-fallback，告知前端没有真 mp4
        yield {
            "type": "artifact", "capability": "V",
            "artifact_type": "video-fallback",
            "title": "视频 fallback（无 ffmpeg / 无图片）",
            "file_path": images[0] if images else "",
            "mime_type": "image/jpeg",
            "session_id": session_id,
        }

    # 4. 缩略图
    try:
        thumb_path = await create_thumbnail(
            video_path=video_out if has_mp4 else None,
            save_dir=save,
            fallback_image=images[0] if images else None,
        )
        yield {
            "type": "artifact", "capability": "V",
            "artifact_type": "thumbnail", "title": "封面",
            "file_path": thumb_path, "mime_type": "image/jpeg",
            "session_id": session_id,
        }
    except Exception as e:  # noqa: BLE001
        logger.warning("v_agent_thumbnail_failed", error=str(e))

    yield {
        "type": "chunk", "capability": "V",
        "text": "完成" if has_mp4 else "完成（fallback，无真 mp4）",
    }


# ============================ ReAct 路径（理解/改视频）============================


_MAX_TOOL_TURNS = 4


async def _react_loop(*, task: SkillStep, upstream: list[Any],
                       session_id: str) -> AsyncIterator[dict]:
    """vision tool_use 循环：让 V agent 自主选 video_probe / keyframes / subtitle。"""
    import anthropic  # noqa: WPS433
    from app.adapters.model_router import pick_chat
    from app.capabilities.video_tools import TOOL_DEFS, call_tool

    choice = pick_chat(purpose="capability_V_describe", prefer_provider="anthropic")
    if not choice.available:
        raise RuntimeError("anthropic not available for V ReAct")

    # 列出上游所有视频 / 字幕路径，让 LLM 知道有什么可分析
    video_paths: list[str] = []
    sub_paths: list[str] = []
    for entry in upstream or []:
        for art in (entry.get("artifacts") or []):
            atype = (art.get("artifact_type") or "").lower()
            fp = art.get("file_path")
            if not fp:
                continue
            if atype.startswith("video"):
                video_paths.append(fp)
            elif atype.startswith("subtitle"):
                sub_paths.append(fp)

    prompt = (
        f"任务：{task.task}\n\n"
        f"session_id：{session_id}\n"
        f"上游视频文件 ({len(video_paths)})：\n"
        + "\n".join(f"  - {p}" for p in video_paths[:3])
        + f"\n上游字幕文件 ({len(sub_paths)})：\n"
        + "\n".join(f"  - {p}" for p in sub_paths[:3])
        + "\n\n你可以用 video_probe（看元信息）、extract_keyframes "
          "（抽帧后再做 vision 分析）、subtitle_to_script（拼字幕成脚本）。"
          "完成后给一段中文总结（≤300 字）。"
    )

    client = anthropic.AsyncAnthropic(api_key=choice.api_key)
    messages: list[dict[str, Any]] = [{"role": "user", "content": prompt}]

    yield {"type": "chunk", "capability": "V", "text": "[V ReAct] 启动视频分析..."}

    summary_text = ""
    for turn in range(_MAX_TOOL_TURNS + 1):
        tools_arg = TOOL_DEFS if turn < _MAX_TOOL_TURNS else None
        kwargs: dict[str, Any] = {
            "model": choice.model,
            "max_tokens": choice.max_tokens,
            "messages": messages,
        }
        if tools_arg:
            kwargs["tools"] = tools_arg

        resp = await client.messages.create(**kwargs)
        tool_uses: list[dict[str, Any]] = []
        round_text = ""
        for block in resp.content:
            if block.type == "text":
                round_text += block.text
            elif block.type == "tool_use":
                tool_uses.append({"id": block.id, "name": block.name,
                                   "input": dict(block.input or {})})

        if round_text:
            summary_text += round_text
            yield {"type": "chunk", "capability": "V", "text": round_text}

        if not tool_uses:
            break

        messages.append({"role": "assistant", "content": resp.content})

        tool_results: list[dict[str, Any]] = []
        for tu in tool_uses:
            # session_id 注入：让 LLM 不用每次都传
            tu_input = dict(tu["input"])
            if tu["name"] == "extract_keyframes" and "session_id" not in tu_input:
                tu_input["session_id"] = session_id
            yield {"type": "tool_call", "capability": "V",
                   "tool": tu["name"], "input": tu_input, "turn": turn + 1}
            result = await call_tool(tu["name"], tu_input)
            yield {"type": "tool_result", "capability": "V",
                   "tool": tu["name"], "result": result, "turn": turn + 1}
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": tu["id"],
                "content": _serialize_tool_result(result),
            })
        messages.append({"role": "user", "content": tool_results})

    yield {
        "type": "artifact",
        "capability": "V",
        "artifact_type": "markdown",
        "title": task.task or "V 看视频分析",
        "content_inline": summary_text or "（无文本输出）",
        "session_id": session_id,
    }


def _serialize_tool_result(result: Any) -> str:
    import json
    try:
        return json.dumps(result, ensure_ascii=False)[:8000]
    except (TypeError, ValueError):
        return str(result)[:8000]
