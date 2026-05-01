"""视频 Agent（剪辑师）— 字幕生成 + FFmpeg 合成 mp4 + 缩略图。

FFmpeg 不可用时创建 fallback artifact（JSON 清单 + 所有素材路径），链路不崩。
"""
from __future__ import annotations

import json
import os

import aiofiles
from langgraph.types import Command

from app.schemas.state import GroupState
from app.config import settings
from app.adapters.tools.subtitle_maker import script_to_srt
from app.adapters.tools.ffmpeg_composer import compose_news_video
from app.adapters.tools.thumbnail_maker import create_thumbnail
from app.adapters.storage.artifact_store import ArtifactStore
from app.utils import make_artifact
from app.logging_config import logger


async def video_node(state: GroupState) -> Command:
    """Video Agent 节点：字幕 → FFmpeg 合成 → 校验 → 缩略图。"""
    group_id = state.get("group_id", "unknown")
    video_dir = os.path.join(settings.ARTIFACT_DIR, group_id, "video")
    os.makedirs(video_dir, exist_ok=True)
    store = ArtifactStore(settings.ARTIFACT_DIR)

    script = state.get("script", {})
    image_paths = state.get("image_paths", [])
    voice_path = state.get("voice_path", "")
    bgm_path = state.get("bgm_path", "")
    duration = script.get("estimated_duration_seconds", 60)

    try:
        # 1. 生成 SRT 字幕
        subtitle_path = await script_to_srt(script, duration, video_dir)
        sub_art = make_artifact(
            "subtitle-asset", "字幕", "video_agent", group_id,
            file_path=subtitle_path, mime_type="application/x-subrip")
        await store.save_file(sub_art, subtitle_path)

        # 2. FFmpeg 合成视频（无 FFmpeg 时返回 None）
        per_image = duration / max(len(image_paths), 1)
        output_path = os.path.join(video_dir, "video.mp4")
        video_path = await compose_news_video(
            images=image_paths, voice=voice_path, bgm=bgm_path,
            bgm_volume_db=-15.0, subtitles=subtitle_path, output=output_path,
            per_image_duration=per_image, resolution="1024x1024",
            timeout=settings.FFMPEG_TIMEOUT,
            encoding={"video_codec": "libx264", "pixel_format": "yuv420p",
                       "audio_codec": "aac", "movflags": "+faststart"})

        artifacts = [sub_art]

        if video_path:
            # FFmpeg 成功：保存视频 + 从视频抽帧做缩略图
            vid_art = make_artifact(
                "video-asset", "反诈短视频", "video_agent", group_id,
                file_path=video_path, mime_type="video/mp4")
            await store.save_file(vid_art, video_path)
            artifacts.append(vid_art)
            thumb_path = await create_thumbnail(video_path, video_dir)
        else:
            # FFmpeg 不可用：创建 fallback artifact（JSON 清单）
            logger.warning("video_agent", action="ffmpeg_fallback")
            fallback_data = {
                "type": "fallback", "reason": "FFmpeg not available",
                "image_paths": image_paths, "voice_path": voice_path,
                "bgm_path": bgm_path, "subtitle_path": subtitle_path,
                "script": script,
            }
            fb_path = os.path.join(video_dir, "fallback_manifest.json")
            async with aiofiles.open(fb_path, "w", encoding="utf-8") as f:
                await f.write(json.dumps(fallback_data, ensure_ascii=False, indent=2))

            fb_art = make_artifact(
                "fallback", "视频降级产物（FFmpeg 未安装）", "video_agent", group_id,
                file_path=fb_path, mime_type="application/json",
                data={"reason": "FFmpeg not installed", "recoverable": True})
            await store.save_file(fb_art, fb_path)
            artifacts.append(fb_art)
            video_path = fb_path

            # 用第一张图片做缩略图
            fallback_img = image_paths[0] if image_paths else None
            thumb_path = await create_thumbnail(None, video_dir, fallback_image=fallback_img)

        # 3. 保存缩略图
        thumb_art = make_artifact(
            "thumbnail", "缩略图", "video_agent", group_id,
            file_path=thumb_path, mime_type="image/jpeg")
        await store.save_file(thumb_art, thumb_path)
        artifacts.append(thumb_art)

        logger.info("video_agent", action="done", has_mp4=video_path.endswith(".mp4"))
        return Command(
            update={
                "video_path": video_path, "subtitle_path": subtitle_path,
                "thumbnail_path": thumb_path, "artifacts": artifacts,
                "agent_status": {"video_agent": "done"},
            },
            goto="orchestrator",
        )
    except Exception as e:
        logger.error("video_agent_failed", error=str(e))
        return Command(
            update={
                "video_path": "error",
                "errors": [{"agent": "video_agent", "error": str(e)}],
                "agent_status": {"video_agent": "error"},
            },
            goto="orchestrator",
        )
