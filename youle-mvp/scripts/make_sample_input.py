"""生成示例反诈新闻 Excel 文件"""
import os
import pandas as pd

SAMPLE_NEWS = [
    {"标题": "男子轻信'高回报投资'被骗500万", "简介": "受害人在社交平台认识'投资顾问'，被诱导下载虚假APP投资", "涉案金额": "500万", "来源": "https://example.com/news/1", "图片": ""},
    {"标题": "网恋对象竟是诈骗团伙成员", "简介": "女子网恋3个月后被对方以各种理由骗走积蓄", "涉案金额": "120万", "来源": "https://example.com/news/2", "图片": ""},
    {"标题": "冒充公检法诈骗再现新套路", "简介": "骗子冒充警察称受害人涉嫌洗钱，要求转账到'安全账户'", "涉案金额": "80万", "来源": "https://example.com/news/3", "图片": ""},
    {"标题": "刷单返利骗局升级：先赚后亏", "简介": "受害人先获得小额返利建立信任，后被要求大额充值", "涉案金额": "35万", "来源": "https://example.com/news/4", "图片": ""},
    {"标题": "虚假贷款APP骗取手续费", "简介": "急需用钱的受害人下载假贷款APP，被要求缴纳各种费用", "涉案金额": "15万", "来源": "https://example.com/news/5", "图片": ""},
    {"标题": "游戏账号交易诈骗频发", "简介": "未成年人在游戏中被骗子以低价卖号为由骗取家长银行卡信息", "涉案金额": "8万", "来源": "https://example.com/news/6", "图片": ""},
    {"标题": "假冒客服退款诈骗", "简介": "骗子冒充电商客服称商品有质量问题需退款，诱导扫码转账", "涉案金额": "3.5万", "来源": "https://example.com/news/7", "图片": ""},
    {"标题": "虚拟货币投资骗局", "简介": "受害人被拉入'币圈交流群'，在虚假交易所充值后无法提现", "涉案金额": "200万", "来源": "https://example.com/news/8", "图片": ""},
    {"标题": "AI换脸视频诈骗", "简介": "骗子利用AI换脸技术冒充亲友进行视频通话骗取转账", "涉案金额": "50万", "来源": "https://example.com/news/9", "图片": ""},
    {"标题": "兼职刷信誉诈骗", "简介": "大学生被招募做'兼职刷单'，垫付资金后对方消失", "涉案金额": "2.8万", "来源": "https://example.com/news/10", "图片": ""},
]


def make_sample_excel(output_path: str = "./data/uploads/sample_news.xlsx") -> str:
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df = pd.DataFrame(SAMPLE_NEWS)
    df.to_excel(output_path, index=False)
    print(f"OK - sample Excel: {output_path}")
    return output_path


if __name__ == "__main__":
    make_sample_excel()
