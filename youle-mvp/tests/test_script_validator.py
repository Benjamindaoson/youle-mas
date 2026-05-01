"""TDD: ScriptValidator tests."""
import pytest
import json
from app.adapters.tools.script_validator import validate_script, ScriptSchema
from app.errors import ScriptValidationError


def test_valid_script_dict():
    script = {
        "hook": "Warning hook",
        "body": ["Case 1", "Case 2"],
        "closing": "Stay safe",
        "estimated_duration_seconds": 60,
    }
    result = validate_script(script)
    assert result["hook"] == "Warning hook"
    assert len(result["body"]) == 2


def test_valid_script_json_string():
    script = json.dumps({
        "hook": "Warning",
        "body": ["Case 1"],
        "closing": "End",
        "estimated_duration_seconds": 30,
    })
    result = validate_script(script)
    assert result["estimated_duration_seconds"] == 30


def test_script_with_evidence():
    script = {
        "hook": "Warning",
        "body": ["Case 1"],
        "closing": "End",
        "estimated_duration_seconds": 60,
        "evidence": [{"news_idx": 1, "amount": "500万", "source": "Excel"}],
    }
    result = validate_script(script)
    assert len(result["evidence"]) == 1


def test_missing_hook_fails():
    with pytest.raises(ScriptValidationError):
        validate_script({"body": ["x"], "closing": "y", "estimated_duration_seconds": 60})


def test_empty_body_fails():
    with pytest.raises(ScriptValidationError):
        validate_script({"hook": "x", "body": [], "closing": "y", "estimated_duration_seconds": 60})


def test_duration_too_short_fails():
    with pytest.raises(ScriptValidationError):
        validate_script({"hook": "x", "body": ["y"], "closing": "z", "estimated_duration_seconds": 5})


def test_duration_too_long_fails():
    with pytest.raises(ScriptValidationError):
        validate_script({"hook": "x", "body": ["y"], "closing": "z", "estimated_duration_seconds": 999})


def test_invalid_json_string_fails():
    with pytest.raises(ScriptValidationError):
        validate_script("not json at all")


def test_hook_too_short_fails():
    with pytest.raises(ScriptValidationError):
        validate_script({"hook": "x", "body": ["y"], "closing": "z", "estimated_duration_seconds": 60})
