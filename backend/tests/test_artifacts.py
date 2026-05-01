import pytest
import os
from datetime import datetime, timezone
from app.schemas.artifacts import Artifact
from app.adapters.storage.artifact_store import ArtifactStore


@pytest.fixture
def store(tmp_path):
    return ArtifactStore(str(tmp_path))


@pytest.fixture
def sample_artifact():
    return Artifact(
        id="art_test_001",
        type="video-script",
        title="Test script",
        by_agent="text_agent",
        group_id="group_test",
        data={"hook": "test"},
        created_at=datetime.now(timezone.utc),
    )


async def test_save_and_list(store, sample_artifact):
    await store.save(sample_artifact)
    arts = await store.list_by_group("group_test")
    assert len(arts) == 1
    assert arts[0].id == "art_test_001"


async def test_save_with_content(store, sample_artifact):
    sample_artifact.file_path = "test.txt"
    await store.save(sample_artifact, content=b"hello world")
    path = await store.get_file_path("art_test_001")
    assert path is not None
    assert os.path.isfile(path)


async def test_get(store, sample_artifact):
    await store.save(sample_artifact)
    art = await store.get("art_test_001")
    assert art is not None
    assert art.type == "video-script"


async def test_get_nonexistent(store):
    art = await store.get("nonexistent")
    assert art is None
