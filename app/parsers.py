from __future__ import annotations

from datetime import datetime
from typing import Dict, Iterable, List


def _split_pairs(lines: Iterable[str]) -> List[Dict[str, str]]:
    records: List[Dict[str, str]] = []
    current: Dict[str, str] = {}
    for raw_line in lines:
        line = raw_line.strip("\n")
        if not line.strip():
            if current:
                records.append(current)
                current = {}
            continue
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        key = key.strip()
        value = value.strip()
        if value.startswith('"') and value.endswith('"'):
            value = value[1:-1]
        current[key] = value
    if current:
        records.append(current)
    return records


def parse_table_output(output: str) -> List[Dict[str, str]]:
    return _split_pairs(output.splitlines())


def parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None
