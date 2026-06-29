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
Training Data Extractor for the OpenMetadata fine-tuned semantic encoder.

Generates self-supervised training pairs from three signals:
  A) Column lineage edges   (positive, soft-positive, hard-negative)
  B) Glossary term co-tags  (positive, negative)
  C) Table co-membership    (soft-positive, hard-negative)

Usage:
    python -m metadata.ml.training_data \\
        --host http://localhost:8585 \\
        --token <jwt> \\
        --output training_pairs.json
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from collections import defaultdict
from itertools import combinations
from typing import Any, Dict, List, Optional, Set, Tuple

logger = logging.getLogger(__name__)

SEP_TOKEN = " [SEP] "
DEFAULT_LIMIT = 1000


# ---------------------------------------------------------------------------
# Core class
# ---------------------------------------------------------------------------

class TrainingDataBuilder:
    """
    Builds training pairs for fine-tuning a semantic encoder from
    OpenMetadata entity relationships.

    Can be used with a live OMeta client::

        builder = TrainingDataBuilder(ometa_client=ometa)
        pairs = builder.extract_all()

    Or methods can be called directly with pre-extracted data for
    unit testing (no client required).
    """

    def __init__(self, ometa_client: Any = None) -> None:
        self.ometa = ometa_client

    # ------------------------------------------------------------------
    # Text formatting
    # ------------------------------------------------------------------

    @staticmethod
    def _column_text(fqn: str, description: Optional[str] = None) -> str:
        """Build the canonical text representation of a column."""
        desc = (description or "").strip()
        return f"{fqn}{SEP_TOKEN}{desc}" if desc else fqn

    # ------------------------------------------------------------------
    # Signal A – Lineage pairs
    # ------------------------------------------------------------------

    def _build_lineage_pairs(
        self,
        edges: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Build positive pairs from lineage edges.

        Args:
            edges: list of dicts with ``from`` and ``to`` keys,
                   each containing ``fqn`` and ``description``.

        Returns:
            list of ``{text_a, text_b, label}`` dicts with *label = 1.0*.
        """
        pairs: List[Dict[str, Any]] = []
        for edge in edges:
            src = edge["from"]
            dst = edge["to"]
            text_a = self._column_text(src["fqn"], src.get("description", ""))
            text_b = self._column_text(dst["fqn"], dst.get("description", ""))
            pairs.append({"text_a": text_a, "text_b": text_b, "label": 1.0})
        return pairs

    # ------------------------------------------------------------------
    # Signal B – Glossary pairs
    # ------------------------------------------------------------------

    def _build_glossary_pairs(
        self,
        glossary_map: Dict[str, List[Dict[str, Any]]],
    ) -> List[Dict[str, Any]]:
        """
        Build positive pairs from glossary term co-tags.

        Args:
            glossary_map: mapping *term_name → list of column dicts*,
                          each with ``fqn`` and ``description``.

        Returns:
            list of ``{text_a, text_b, label}`` dicts with *label = 1.0*.
        """
        pairs: List[Dict[str, Any]] = []
        for _term, cols in glossary_map.items():
            for i, ca in enumerate(cols):
                for cb in cols[i + 1 :]:
                    text_a = self._column_text(ca["fqn"], ca.get("description", ""))
                    text_b = self._column_text(cb["fqn"], cb.get("description", ""))
                    pairs.append({"text_a": text_a, "text_b": text_b, "label": 1.0})
        return pairs

    # ------------------------------------------------------------------
    # Signal C – Table co-membership
    # ------------------------------------------------------------------

    def _build_table_pairs(
        self,
        cols: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Build soft-positive pairs for columns in the same table.

        Args:
            cols: list of column dicts with ``fqn`` and ``description``.

        Returns:
            list of ``{text_a, text_b, label}`` dicts with *label = 0.5*.
        """
        pairs: List[Dict[str, Any]] = []
        seen: Set[Tuple[str, str]] = set()
        for i, ca in enumerate(cols):
            for cb in cols[i + 1 :]:
                key = tuple(sorted([ca["fqn"], cb["fqn"]]))
                if key in seen:
                    continue
                seen.add(key)
                text_a = self._column_text(ca["fqn"], ca.get("description", ""))
                text_b = self._column_text(cb["fqn"], cb.get("description", ""))
                pairs.append({"text_a": text_a, "text_b": text_b, "label": 0.5})
        return pairs

    # ------------------------------------------------------------------
    # Hard negatives (cross-service)
    # ------------------------------------------------------------------

    def _build_hard_negatives(
        self,
        cols: List[Dict[str, Any]],
        max_negatives: int = 500,
    ) -> List[Dict[str, Any]]:
        """
        Build hard-negative pairs for columns from different services.

        Service is inferred from the first segment of the FQN.
        Pairs are capped at ``max_negatives`` to prevent O(n²) blowup
        when many services and columns are present.

        Args:
            cols: list of column dicts with ``fqn`` and ``description``.
            max_negatives: maximum number of negative pairs to generate.

        Returns:
            list of ``{text_a, text_b, label}`` dicts with *label = 0.0*.
        """
        by_service: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        for col in cols:
            service = col["fqn"].split(".")[0]
            by_service[service].append(col)

        pairs: List[Dict[str, Any]] = []
        services = list(by_service.keys())
        for i, svc_a in enumerate(services):
            for svc_b in services[i + 1 :]:
                for ca in by_service[svc_a]:
                    for cb in by_service[svc_b]:
                        text_a = self._column_text(ca["fqn"], ca.get("description", ""))
                        text_b = self._column_text(cb["fqn"], cb.get("description", ""))
                        pairs.append({"text_a": text_a, "text_b": text_b, "label": 0.0})
                        if len(pairs) >= max_negatives:
                            return pairs
        return pairs

    # ------------------------------------------------------------------
    # Full extraction from live OpenMetadata
    # ------------------------------------------------------------------

    def extract_all(self, limit: int = DEFAULT_LIMIT) -> List[Dict[str, Any]]:
        """
        Extract all training pairs from a live OpenMetadata instance.

        Requires ``self.ometa`` to be a configured
        :class:`metadata.ingestion.ometa.ometa_api.OpenMetadata` client.
        """
        if self.ometa is None:
            raise RuntimeError("No OMeta client configured — pass ometa_client to constructor")

        from metadata.generated.schema.entity.data.table import Table

        all_pairs: List[Dict[str, Any]] = []
        tables = list(self.ometa.list_all_entities(
            entity=Table, limit=limit, fields=["columns", "tags"]
        ))
        logger.info("Fetched %d tables.", len(tables))

        # ---- Signal A: Lineage ----
        edges: List[Dict[str, Any]] = []
        table_columns: Dict[str, List[Dict[str, Any]]] = {}
        table_id_to_fqn: Dict[str, str] = {}
        adjacency: Dict[str, Set[str]] = defaultdict(set)

        for table in tables:
            tid = str(table.id.root)
            table_id_to_fqn[tid] = table.fullyQualifiedName.root
            col_infos = []
            for col in table.columns or []:
                cfqn = col.fullyQualifiedName.root if col.fullyQualifiedName else col.name.root
                cdesc = col.description.root if col.description else ""
                col_infos.append({"fqn": cfqn, "description": cdesc})
            table_columns[tid] = col_infos

            try:
                resp = self.ometa.client.get(
                    f"/api/v1/lineage/table/{tid}?upstreamDepth=1&downstreamDepth=1"
                )
                if resp:
                    for de in resp.get("downstreamEdges", []):
                        to_id = de.get("toEntity", "")
                        adjacency[tid].add(to_id)
                        adjacency[to_id].add(tid)
                        for cl in de.get("columnLineage", []):
                            for fc in cl.get("fromColumns", []):
                                for tc in cl.get("toColumns", []):
                                    edges.append({"from": {"fqn": fc, "description": ""},
                                                  "to": {"fqn": tc, "description": ""}})
            except Exception as exc:
                logger.debug("Lineage fetch failed for %s: %s", tid, exc)

        all_pairs.extend(self._build_lineage_pairs(edges))

        # Soft positives from tables on lineage edges
        for tid in set(adjacency.keys()):
            cols = table_columns.get(tid, [])
            if len(cols) >= 2:
                for ca, cb in list(combinations(cols, 2))[:10]:
                    all_pairs.append({
                        "text_a": self._column_text(ca["fqn"], ca["description"]),
                        "text_b": self._column_text(cb["fqn"], cb["description"]),
                        "label": 0.7,
                    })

        # ---- Signal B: Glossary ----
        term_to_cols: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        for table in tables:
            for col in table.columns or []:
                cfqn = col.fullyQualifiedName.root if col.fullyQualifiedName else col.name.root
                cdesc = col.description.root if col.description else ""
                for tag in col.tags or []:
                    tag_fqn = tag.tagFQN.root
                    if "." in tag_fqn:
                        term_to_cols[tag_fqn].append({"fqn": cfqn, "description": cdesc})
        all_pairs.extend(self._build_glossary_pairs(term_to_cols))

        # ---- Signal C: Table co-membership + cross-service negatives ----
        service_cols: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        for table in tables:
            svc = table.service.name if table.service else "unknown"
            for col in table.columns or []:
                cfqn = col.fullyQualifiedName.root if col.fullyQualifiedName else col.name.root
                cdesc = col.description.root if col.description else ""
                service_cols[svc].append({"fqn": cfqn, "description": cdesc})
            cols = table_columns.get(str(table.id.root), [])
            all_pairs.extend(self._build_table_pairs(cols[:20]))

        # Cross-service hard negatives
        if len(service_cols) >= 2:
            for s1 in list(service_cols.keys()):
                for s2 in list(service_cols.keys()):
                    if s1 >= s2:
                        continue
                    for ca in service_cols[s1][:5]:
                        for cb in service_cols[s2][:1]:
                            all_pairs.append({
                                "text_a": self._column_text(ca["fqn"], ca["description"]),
                                "text_b": self._column_text(cb["fqn"], cb["description"]),
                                "label": 0.0,
                            })

        logger.info("Total training pairs extracted: %d", len(all_pairs))
        return all_pairs


# ---------------------------------------------------------------------------
# CLI helpers
# ---------------------------------------------------------------------------

def _build_ometa_client(host: str, token: str):
    """Create an OpenMetadata SDK client following the existing codebase pattern."""
    from metadata.ingestion.ometa.ometa_api import OpenMetadata
    from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
        OpenMetadataConnection,
    )
    from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
        OpenMetadataJWTClientConfig,
    )

    connection = OpenMetadataConnection(
        hostPort=host,
        authProvider="openmetadata",
        securityConfig=OpenMetadataJWTClientConfig(jwtToken=token),
    )
    return OpenMetadata(connection)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extract training data from OpenMetadata for fine-tuning the semantic encoder."
    )
    parser.add_argument("--host", required=True, help="OpenMetadata server URL")
    parser.add_argument("--token", required=True, help="JWT auth token")
    parser.add_argument("--output", default="training_pairs.json", help="Output JSON file")
    parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT, help="Max entities per type")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    ometa = _build_ometa_client(args.host, args.token)
    builder = TrainingDataBuilder(ometa_client=ometa)
    pairs = builder.extract_all(limit=args.limit)

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(pairs, f, indent=2, ensure_ascii=False)
    logger.info("Saved %d training pairs to %s", len(pairs), args.output)


if __name__ == "__main__":
    main()
