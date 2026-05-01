"""自定义异常体系 — 每种错误有唯一 code，便于前端展示和日志排查。"""


class YouleError(Exception):
    """所有业务异常的基类。"""
    code: str = "YOULE-000"
    recoverable: bool = True  # True 表示 fallback 可兜底，链路不崩


class DownloadError(YouleError):
    """图片/文件下载失败。"""
    code = "DRV-001"


class TtsError(YouleError):
    """TTS 语音合成失败。"""
    code = "DRV-002"


class FFmpegError(YouleError):
    """FFmpeg 视频合成失败。"""
    code = "DRV-003"


class ScriptValidationError(YouleError):
    """脚本 JSON 校验失败（格式不符合 ScriptSchema）。"""
    code = "DRV-004"


class GatewayError(YouleError):
    """模型网关调用失败（API 超时/鉴权/限流）。"""
    code = "DRV-005"


class ExcelReadError(YouleError):
    """Excel/CSV 文件读取或解析失败。"""
    code = "DRV-006"
