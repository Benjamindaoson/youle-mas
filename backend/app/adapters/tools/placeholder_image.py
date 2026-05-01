"""占位图生成工具，使用 Pillow 绘制带警告三角和文字的占位图片。"""

from __future__ import annotations

import asyncio
import os
import uuid

from PIL import Image, ImageDraw, ImageFont


def _get_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    """按优先级尝试加载中文字体，找不到则回退到默认字体。"""
    candidates = [
        # Windows
        "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/msyh.ttf",
        "C:/Windows/Fonts/simhei.ttf",
        # Linux: Noto / WenQuanYi / DejaVu
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        # macOS
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
    ]
    for path in candidates:
        if os.path.isfile(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


async def create_placeholder(text: str, save_dir: str, size: str = "1024x1024") -> str:
    """异步生成占位图片，包含警告三角图标和截断后的文字标题。"""
    def _sync_create() -> str:
        w, h = (int(x) for x in size.split("x"))
        # 深红色背景
        img = Image.new("RGB", (w, h), color=(139, 0, 0))
        draw = ImageDraw.Draw(img)

        # 绘制居中的警告三角形
        tri_size = min(w, h) // 4
        cx, cy = w // 2, h // 3
        triangle = [
            (cx, cy - tri_size // 2),
            (cx - tri_size // 2, cy + tri_size // 2),
            (cx + tri_size // 2, cy + tri_size // 2),
        ]
        draw.polygon(triangle, fill=(255, 200, 0))

        # 三角形内绘制感叹号
        excl_font = _get_font(tri_size // 2)
        draw.text((cx, cy + tri_size // 8), "!", fill=(139, 0, 0), font=excl_font, anchor="mm")

        # 底部绘制文字，超长截断
        text_font = _get_font(max(20, min(w, h) // 20))
        display = text[:30] + "..." if len(text) > 30 else text
        draw.text((cx, h * 2 // 3), display, fill="white", font=text_font, anchor="mm")

        os.makedirs(save_dir, exist_ok=True)
        fname = f"placeholder_{uuid.uuid4().hex}.jpg"
        path = os.path.join(save_dir, fname)
        img.save(path, "JPEG", quality=85)
        return path

    return await asyncio.to_thread(_sync_create)
