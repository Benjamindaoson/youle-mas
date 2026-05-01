"""图片裁剪缩放工具，将图片按目标比例居中裁剪后缩放到指定尺寸。"""

from __future__ import annotations

import asyncio

from PIL import Image


async def resize_image(path: str, target_size: str = "1024x1024") -> str:
    """异步将图片裁剪并缩放到目标尺寸，原地覆盖保存。"""
    def _sync_resize() -> str:
        w, h = (int(x) for x in target_size.split("x"))
        img = Image.open(path)
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
