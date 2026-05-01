"""新闻条目数据模型 — 从 Excel/CSV 读取后标准化为此结构。"""
from pydantic import BaseModel


class NewsItem(BaseModel):
    """单条新闻的标准化结构。"""
    idx: int              # 序号（从 1 开始）
    title: str            # 新闻标题
    summary: str          # 新闻摘要
    amount: str = ""      # 涉案金额（如 "500万"）
    url: str = ""         # 新闻来源 URL
    image_url: str = ""   # 配图 URL（可能为空）
