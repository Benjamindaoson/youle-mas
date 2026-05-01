import pytest
import os
import pandas as pd
from app.adapters.tools.excel_reader import read_excel
from app.adapters.tools.news_normalizer import normalize_news


@pytest.fixture
def sample_xlsx(tmp_path):
    data = {
        "标题": ["诈骗案1", "诈骗案2", "诈骗案3"],
        "简介": ["简介1", "简介2", "简介3"],
        "涉案金额": ["100万", "200万", "300万"],
        "来源": ["http://a.com", "http://b.com", "http://c.com"],
        "图片": ["", "", ""],
    }
    path = str(tmp_path / "test.xlsx")
    pd.DataFrame(data).to_excel(path, index=False)
    return path


@pytest.fixture
def sample_csv(tmp_path):
    data = {"title": ["case1", "case2"], "summary": ["s1", "s2"], "amount": ["10", "20"]}
    path = str(tmp_path / "test.csv")
    pd.DataFrame(data).to_csv(path, index=False)
    return path


def test_read_xlsx(sample_xlsx):
    rows = read_excel(sample_xlsx)
    assert len(rows) == 3
    assert rows[0]["title"] == "诈骗案1"
    assert rows[0]["amount"] == "100万"


def test_read_csv(sample_csv):
    rows = read_excel(sample_csv)
    assert len(rows) == 2
    assert rows[0]["title"] == "case1"


def test_fuzzy_column_match(sample_xlsx):
    rows = read_excel(sample_xlsx)
    assert "title" in rows[0]
    assert "amount" in rows[0]


def test_file_not_found():
    with pytest.raises(FileNotFoundError):
        read_excel("/nonexistent/file.xlsx")


def test_normalize(sample_xlsx):
    rows = read_excel(sample_xlsx)
    items = normalize_news(rows)
    assert len(items) == 3
    assert items[0].title == "诈骗案1"
    assert items[0].amount == "100万"
