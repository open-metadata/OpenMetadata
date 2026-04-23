#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Parser for SSRS RDL (Report Definition Language) XML documents.

RDL namespaces differ across SSRS versions (2008/2010/2016+). Traversal is
namespace-agnostic: we compare element local names.
"""
from dataclasses import dataclass, field
from typing import List, Optional, Tuple
from xml.etree import ElementTree as ET

SERVER_KEYS = {"data source", "server", "address", "addr", "network address"}
DATABASE_KEYS = {"initial catalog", "database"}
FORBIDDEN_XML_TOKENS = (b"<!doctype", b"<!entity")


@dataclass
class SsrsField:
    name: str
    data_field: Optional[str] = None


@dataclass
class SsrsDataSource:
    name: str
    data_provider: Optional[str] = None
    connect_string: Optional[str] = None
    server: Optional[str] = None
    database: Optional[str] = None
    shared_reference: Optional[str] = None


@dataclass
class SsrsDataSet:
    name: str
    data_source_name: Optional[str] = None
    command_type: Optional[str] = None
    command_text: Optional[str] = None
    fields: List[SsrsField] = field(default_factory=list)
    shared_reference: Optional[str] = None


@dataclass
class SsrsReportDefinition:
    data_sources: List[SsrsDataSource] = field(default_factory=list)
    data_sets: List[SsrsDataSet] = field(default_factory=list)


def parse_rdl(rdl_bytes: bytes) -> SsrsReportDefinition:
    """Parse RDL XML into a structured definition. Raises ``ValueError`` on malformed
    XML or when the document contains a DTD / entity declaration (guard against
    billion-laughs expansion since stdlib ElementTree honors internal entities)."""
    if not rdl_bytes:
        raise ValueError("Empty RDL content")
    lowered = rdl_bytes.lower()
    if any(token in lowered for token in FORBIDDEN_XML_TOKENS):
        raise ValueError("RDL contains a DTD or entity declaration; refusing to parse")
    del lowered
    try:
        root = ET.fromstring(rdl_bytes)
    except ET.ParseError as exc:
        raise ValueError(f"Malformed RDL XML: {exc}") from exc
    return SsrsReportDefinition(
        data_sources=_parse_data_sources(root),
        data_sets=_parse_data_sets(root),
    )


def parse_connect_string(
    connect_string: Optional[str],
) -> Tuple[Optional[str], Optional[str]]:
    """Extract ``(server, database)`` from a connection string.

    Accepts common SSRS/SQL-Server variants (``Data Source=``, ``Server=``,
    ``Initial Catalog=``, ``Database=``). Case-insensitive, semicolon-delimited."""
    if not connect_string:
        return None, None
    server: Optional[str] = None
    database: Optional[str] = None
    for segment in connect_string.split(";"):
        if "=" not in segment:
            continue
        key, _, value = segment.partition("=")
        key_lower = key.strip().lower()
        value = value.strip()
        if not value:
            continue
        if server is None and key_lower in SERVER_KEYS:
            server = value
        elif database is None and key_lower in DATABASE_KEYS:
            database = value
    return server, database


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _find_child(parent: ET.Element, name: str) -> Optional[ET.Element]:
    for child in parent:
        if _local(child.tag) == name:
            return child
    return None


def _find_children(parent: ET.Element, name: str) -> List[ET.Element]:
    return [child for child in parent if _local(child.tag) == name]


def _text(elem: Optional[ET.Element]) -> Optional[str]:
    if elem is None or elem.text is None:
        return None
    stripped = elem.text.strip()
    return stripped or None


def _parse_data_sources(root: ET.Element) -> List[SsrsDataSource]:
    container = _find_child(root, "DataSources")
    if container is None:
        return []
    sources: List[SsrsDataSource] = []
    for ds_elem in _find_children(container, "DataSource"):
        name = ds_elem.attrib.get("Name") or ""
        if not name:
            continue
        ref = _find_child(ds_elem, "DataSourceReference")
        if ref is not None:
            sources.append(SsrsDataSource(name=name, shared_reference=_text(ref)))
            continue
        props = _find_child(ds_elem, "ConnectionProperties")
        if props is None:
            sources.append(SsrsDataSource(name=name))
            continue
        connect_string = _text(_find_child(props, "ConnectString"))
        data_provider = _text(_find_child(props, "DataProvider"))
        server, database = parse_connect_string(connect_string)
        sources.append(
            SsrsDataSource(
                name=name,
                data_provider=data_provider,
                connect_string=connect_string,
                server=server,
                database=database,
            )
        )
    return sources


def _parse_data_sets(root: ET.Element) -> List[SsrsDataSet]:
    container = _find_child(root, "DataSets")
    if container is None:
        return []
    datasets: List[SsrsDataSet] = []
    for ds_elem in _find_children(container, "DataSet"):
        name = ds_elem.attrib.get("Name") or ""
        if not name:
            continue
        shared_ref = _text(_find_child(ds_elem, "SharedDataSet"))
        if shared_ref is None:
            shared_container = _find_child(ds_elem, "SharedDataSetReference")
            shared_ref = _text(shared_container)
        datasets.append(_build_dataset(ds_elem, name, shared_ref))
    return datasets


def _build_dataset(
    ds_elem: ET.Element, name: str, shared_ref: Optional[str]
) -> SsrsDataSet:
    query = _find_child(ds_elem, "Query")
    command_type = None
    command_text = None
    data_source_name = None
    if query is not None:
        data_source_name = _text(_find_child(query, "DataSourceName"))
        command_type = _text(_find_child(query, "CommandType"))
        command_text = _text(_find_child(query, "CommandText"))
    return SsrsDataSet(
        name=name,
        data_source_name=data_source_name,
        command_type=command_type,
        command_text=command_text,
        fields=_parse_fields(ds_elem),
        shared_reference=shared_ref,
    )


def _parse_fields(ds_elem: ET.Element) -> List[SsrsField]:
    fields_container = _find_child(ds_elem, "Fields")
    if fields_container is None:
        return []
    fields: List[SsrsField] = []
    for field_elem in _find_children(fields_container, "Field"):
        field_name = field_elem.attrib.get("Name")
        if not field_name:
            continue
        fields.append(
            SsrsField(
                name=field_name,
                data_field=_text(_find_child(field_elem, "DataField")),
            )
        )
    return fields
