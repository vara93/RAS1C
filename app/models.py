from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, ConfigDict



class ApiModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, allow_population_by_field_name=True)


class Cluster(ApiModel):
    uuid: str = Field(alias="cluster")
    host: str
    port: int
    name: str
    load_balancing_mode: Optional[str] = Field(default=None, alias="load-balancing-mode")


class Infobase(ApiModel):
    uuid: str = Field(alias="infobase")
    name: str
    descr: Optional[str] = None


class Session(ApiModel):
    uuid: str = Field(alias="session")
    session_id: Optional[int] = Field(default=None, alias="session-id")
    infobase: str
    user_name: Optional[str] = Field(default=None, alias="user-name")
    host: Optional[str] = None
    app_id: Optional[str] = Field(default=None, alias="app-id")
    started_at: Optional[datetime] = Field(default=None, alias="started-at")
    last_active_at: Optional[datetime] = Field(default=None, alias="last-active-at")
    bytes_all: Optional[int] = Field(default=None, alias="bytes-all")
    calls_all: Optional[int] = Field(default=None, alias="calls-all")


class Process(ApiModel):
    uuid: str = Field(alias="process")
    host: str
    port: int
    pid: int
    turned_on: Optional[bool] = Field(default=None, alias="turned-on")
    running: Optional[bool] = None
    available_perfomance: Optional[int] = Field(default=None, alias="available-perfomance")
    connections: Optional[int] = None


class Connection(ApiModel):
    uuid: str = Field(alias="connection")
    conn_id: Optional[int] = Field(default=None, alias="conn-id")
    host: str
    process: str
    infobase: str
    application: Optional[str] = None
    connected_at: Optional[datetime] = Field(default=None, alias="connected-at")


class Lock(ApiModel):
    connection: str
    session: str
    object: str
    locked: Optional[datetime] = None
    descr: Optional[str] = None


class License(ApiModel):
    session: str
    user_name: Optional[str] = Field(default=None, alias="user-name")
    host: Optional[str] = None
    app_id: Optional[str] = Field(default=None, alias="app-id")
    series: Optional[str] = None
    license_type: Optional[str] = Field(default=None, alias="license-type")
    issued_by_server: Optional[bool] = Field(default=None, alias="issued-by-server")
    full_presentation: Optional[str] = Field(default=None, alias="full-presentation")


class RasSnapshot(ApiModel):
    cluster: Optional[Cluster] = None
    infobases: List[Infobase] = Field(default_factory=list)
    sessions: List[Session] = Field(default_factory=list)
    connections: List[Connection] = Field(default_factory=list)
    processes: List[Process] = Field(default_factory=list)
    locks: List[Lock] = Field(default_factory=list)
    licenses: List[License] = Field(default_factory=list)
