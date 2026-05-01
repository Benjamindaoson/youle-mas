"""Excel/CSV 文件读取工具，支持模糊列名匹配，将表格数据转为标准化字典列表。"""

from __future__ import annotations

import os
import pandas as pd
from app.errors import ExcelReadError

# 防 ZIP/Excel 炸弹：超过此大小直接拒绝（一份新闻列表远小于此）
MAX_EXCEL_BYTES = 20 * 1024 * 1024
# 防超大表格 OOM：限制最大行数（pandas 读完后再裁剪也能一定程度缓解）
MAX_ROWS = 10000

# 标准字段名 -> 可能出现的列名候选列表（中英文混合）
COLUMN_MAP = {
    "title": ["标题", "新闻标题", "title", "Title"],
    "summary": ["简介", "新闻简介", "summary", "Summary", "摘要"],
    "amount": ["涉案金额", "金额", "amount", "Amount"],
    "url": ["来源", "新闻来源", "URL", "url", "link", "Link"],
    "image_url": ["图片", "图片URL", "image_url", "image", "Image", "图片链接"],
}


def _match_columns(df: pd.DataFrame) -> dict[str, str]:
    """将 DataFrame 的实际列名与标准字段名进行模糊匹配，返回映射关系。"""
    mapping = {}
    cols = list(df.columns)
    for std_name, candidates in COLUMN_MAP.items():
        for c in candidates:
            if c in cols:
                mapping[std_name] = c
                break
    return mapping


def read_excel(path: str) -> list[dict]:
    """读取 Excel 或 CSV 文件，自动匹配列名并返回标准化的字典列表。"""
    if not os.path.isfile(path):
        raise FileNotFoundError(f"文件不存在: {path}")

    size = os.path.getsize(path)
    if size > MAX_EXCEL_BYTES:
        raise ExcelReadError(
            f"文件过大: {size} 字节 > 上限 {MAX_EXCEL_BYTES}（防 ZIP 炸弹）"
        )

    ext = os.path.splitext(path)[1].lower()
    try:
        if ext == ".csv":
            df = pd.read_csv(path, nrows=MAX_ROWS)
        elif ext in (".xlsx", ".xls"):
            df = pd.read_excel(path, nrows=MAX_ROWS)
        else:
            raise ExcelReadError(f"不支持的文件格式: {ext}")
    except ExcelReadError:
        raise
    except Exception as e:
        raise ExcelReadError(f"读取文件失败: {e}") from e

    col_map = _match_columns(df)
    if "title" not in col_map:
        raise ExcelReadError("找不到标题列（title / 标题 / 新闻标题）")

    rows = []
    for i, row in df.iterrows():
        item = {"idx": i + 1}
        for std_name, col_name in col_map.items():
            val = row.get(col_name, "")
            # NaN 值统一转为空字符串
            item[std_name] = "" if pd.isna(val) else str(val).strip()
        # 未匹配到的标准字段填充空字符串
        for std_name in COLUMN_MAP:
            if std_name not in item:
                item[std_name] = ""
        rows.append(item)

    return rows
