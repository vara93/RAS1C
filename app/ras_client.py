from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Dict, List, Optional

try:
    from fastapi import HTTPException
except ModuleNotFoundError:  # pragma: no cover - fallback for tooling
    class HTTPException(Exception):
        def __init__(self, status_code: int, detail: str):
            self.status_code = status_code
            self.detail = detail
            super().__init__(detail)

from .config import get_settings
from .models import (
    Cluster,
    Connection,
    Infobase,
    License,
    Lock,
    Process,
    RasSnapshot,
    Session,
)
from .parsers import parse_datetime, parse_table_output


class RacCommandError(RuntimeError):
    pass


def _normalize_bool(value: object) -> object:
    if isinstance(value, str):
        lowered = value.lower()
        if lowered in {"yes", "true", "1"}:
            return True
        if lowered in {"no", "false", "0"}:
            return False
    return value


class RacClient:
    def __init__(self, rac_path: Path, ras_address: str, timeout: float = 10.0):
        self.rac_path = rac_path
        self.ras_address = ras_address
        self.timeout = timeout

    def _run(self, args: List[str]) -> str:
        command = [str(self.rac_path), *args, self.ras_address]
        try:
            completed = subprocess.run(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=self.timeout,
                check=False,
                text=True,
            )
        except FileNotFoundError as exc:
            raise RacCommandError(f"rac binary not found at {self.rac_path}") from exc
        except subprocess.TimeoutExpired as exc:
            raise RacCommandError(
                f"rac command timed out after {self.timeout} seconds"
            ) from exc
        if completed.returncode != 0:
            raise RacCommandError(
                f"rac command failed ({completed.returncode}): {completed.stderr.strip()}"
            )
        return completed.stdout

    def _list(self, entity: str, *extra_args: str) -> List[Dict[str, str]]:
        args = entity.split()
        args.extend(extra_args)
        output = self._run(args)
        return parse_table_output(output)

    def list_clusters(self) -> List[Cluster]:
        records = self._list("cluster list")
        return [Cluster(**record) for record in records]

    def list_infobases(self, cluster_uuid: str) -> List[Infobase]:
        records = self._list("infobase summary list", "--cluster", cluster_uuid)
        return [Infobase(**record) for record in records]

    def list_sessions(self, cluster_uuid: str) -> List[Session]:
        records = self._list("session list", "--cluster", cluster_uuid)
        converted: List[Dict[str, object]] = []
        for record in records:
            parsed: Dict[str, object] = dict(record)
            parsed["started-at"] = parse_datetime(record.get("started-at"))
            parsed["last-active-at"] = parse_datetime(record.get("last-active-at"))
            converted.append(parsed)
        return [Session(**record) for record in converted]

    def list_processes(self, cluster_uuid: str) -> List[Process]:
        records = self._list("process list", "--cluster", cluster_uuid)
        converted: List[Dict[str, object]] = []
        for record in records:
            parsed: Dict[str, object] = dict(record)
            parsed['turned-on'] = _normalize_bool(record.get('turned-on'))
            parsed['running'] = _normalize_bool(record.get('running'))
            converted.append(parsed)
        return [Process(**record) for record in converted]

    def list_connections(self, cluster_uuid: str) -> List[Connection]:
        records = self._list("connection list", "--cluster", cluster_uuid)
        converted: List[Dict[str, object]] = []
        for record in records:
            parsed: Dict[str, object] = dict(record)
            parsed["connected-at"] = parse_datetime(record.get("connected-at"))
            converted.append(parsed)
        return [Connection(**record) for record in converted]

    def list_locks(self, cluster_uuid: str) -> List[Lock]:
        records = self._list("lock list", "--cluster", cluster_uuid)
        converted: List[Dict[str, object]] = []
        for record in records:
            parsed: Dict[str, object] = dict(record)
            parsed["locked"] = parse_datetime(record.get("locked"))
            converted.append(parsed)
        return [Lock(**record) for record in converted]

    def list_licenses(self, cluster_uuid: str) -> List[License]:
        records = self._list("session list", "--cluster", cluster_uuid, "--licenses")
        return [License(**record) for record in records]


class FakeRacClient(RacClient):
    def __init__(self, data_dir: Path, ras_address: str):
        super().__init__(rac_path=data_dir / "rac", ras_address=ras_address)
        self.data_dir = data_dir

    def _run(self, args: List[str]) -> str:  # type: ignore[override]
        file_key = "_".join(arg.strip("-") for arg in args if arg not in {"--cluster", "--licenses"})
        if "--licenses" in args:
            file_key += "_licenses"
        file_name = f"{file_key}.txt"
        file_path = self.data_dir / file_name
        if not file_path.exists():
            raise RacCommandError(f"Fake data file {file_name} not found in {self.data_dir}")
        return file_path.read_text(encoding="utf-8")


def get_ras_client() -> RacClient:
    settings = get_settings()
    ras_address = f"{settings.ras_host}:{settings.ras_port}"
    if settings.fake_data_dir:
        return FakeRacClient(settings.fake_data_dir, ras_address)
    return RacClient(settings.rac_path, ras_address, settings.request_timeout)


def get_cluster_uuid(client: RacClient, preferred_uuid: Optional[str]) -> str:
    if preferred_uuid:
        return preferred_uuid
    clusters = client.list_clusters()
    if not clusters:
        raise HTTPException(status_code=404, detail="No clusters found")
    return clusters[0].uuid


def collect_snapshot() -> RasSnapshot:
    settings = get_settings()
    client = get_ras_client()
    cluster_uuid = get_cluster_uuid(client, settings.cluster_uuid)

    try:
        cluster = next((c for c in client.list_clusters() if c.uuid == cluster_uuid), None)
    except RacCommandError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    if cluster is None:
        raise HTTPException(status_code=404, detail="Cluster not found")

    def safe_call(func):
        try:
            return func()
        except RacCommandError as exc:  # pragma: no cover - defensive
            raise HTTPException(status_code=502, detail=str(exc))

    infobases = safe_call(lambda: client.list_infobases(cluster_uuid))
    sessions = safe_call(lambda: client.list_sessions(cluster_uuid))
    connections = safe_call(lambda: client.list_connections(cluster_uuid))
    processes = safe_call(lambda: client.list_processes(cluster_uuid))
    locks = safe_call(lambda: client.list_locks(cluster_uuid))
    licenses = safe_call(lambda: client.list_licenses(cluster_uuid))

    return RasSnapshot(
        cluster=cluster,
        infobases=infobases,
        sessions=sessions,
        connections=connections,
        processes=processes,
        locks=locks,
        licenses=licenses,
    )
