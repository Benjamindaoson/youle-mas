"""新闻数据标准化工具，将原始字典列表转换为 NewsItem 模型列表。"""

from app.schemas.news import NewsItem


def normalize_news(rows: list[dict]) -> list[NewsItem]:
    """将原始行数据列表标准化为 NewsItem 对象，跳过无标题的行。"""
    items = []
    for row in rows:
        title = row.get("title", "").strip()
        if not title:
            continue
        items.append(NewsItem(
            idx=row.get("idx", len(items) + 1),
            title=title,
            summary=row.get("summary", ""),
            amount=row.get("amount", ""),
            url=row.get("url", ""),
            image_url=row.get("image_url", ""),
        ))
    return items
