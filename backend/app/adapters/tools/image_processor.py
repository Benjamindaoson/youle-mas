"""图片裁剪缩放工具，将图片按目标比例居中裁剪后缩放到指定尺寸。"""

from __future__ import annotations

import asyncio
import os

from PIL import Image, UnidentifiedImageError

# 防超大/恶意图片：超过此大小直接拒绝处理
MAX_IMAGE_BYTES = 15 * 1024 * 1024
# Pillow 自带的解压炸弹防护阈值（像素数），超过时 PIL 会抛 DecompressionBombError
Image.MAX_IMAGE_PIXELS = 50_000_000


class InvalidImageError(Exception):
    """图片格式无效或超过安全上限。"""


async def resize_image(path: str, target_size: str = "1024x1024") -> str:
    """异步将图片裁剪并缩放到目标尺寸，原地覆盖保存。"""
    def _sync_resize() -> str:
        if not os.path.isfile(path):
            raise InvalidImageError(f"image_not_found: {path}")
        size = os.path.getsize(path)
        if size > MAX_IMAGE_BYTES:
            raise InvalidImageError(
                f"image_too_large: {size} bytes > {MAX_IMAGE_BYTES}")

        # 先用 verify() 校验完整性（会消耗文件指针，必须重开）
        try:
            with Image.open(path) as probe:
                probe.verify()
        except (UnidentifiedImageError, Image.DecompressionBombError, OSError) as e:
            raise InvalidImageError(f"image_invalid: {e}") from e

        w, h = (int(x) for x in target_size.split("x"))
        with Image.open(path) as img:
            img = img.convert("RGB") if img.mode not in ("RGB", "L") else img
            img_ratio = img.width / img.height
            target_ratio = w / h
            # 宽高比不一致时居中裁剪，保证不变形
            if img_ratio > target_ratio:
                new_w = int(img.height * target_ratio)
                left = (img.width - new_w) // 2
                img = img.crop((left, 0, left + new_w, img.height))
            elif img_ratio < target_ratio:
                new_h = int(img.width / target_ratio)
                top = (img.height - new_h) // 2
                img = img.crop((0, top, img.width, top + new_h))
            img = img.resize((w, h), Image.LANCZOS)
            img.save(path, quality=90)
        return path

    return await asyncio.to_thread(_sync_resize)
