from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic import BaseModel, Field


class Settings(BaseModel):
    rac_path: Path = Field(
        default=Path(os.environ.get("RAC_PATH", "/opt/1cv8/x86_64/8.3.27.1719/rac"))
    )
    ras_host: str = Field(default=os.environ.get("RAS_HOST", "t03-1c11.fd.local"))
    ras_port: int = Field(default=int(os.environ.get("RAS_PORT", "1545")))
    cluster_uuid: Optional[str] = Field(default=os.environ.get("CLUSTER_UUID"))
    request_timeout: float = Field(default=float(os.environ.get("RAC_TIMEOUT", "10")))
    fake_data_dir: Optional[Path] = Field(
        default=Path(os.environ["RAS_FAKE_DATA"])
        if os.environ.get("RAS_FAKE_DATA")
        else None
    )

    class Config:
        frozen = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()
