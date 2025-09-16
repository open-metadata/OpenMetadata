"""
GlossaryTerm entity operations for OpenMetadata SDK.
"""
from typing import List, Optional

from metadata.generated.schema.api.data.createGlossaryTerm import (
    CreateGlossaryTermRequest,
)
from metadata.generated.schema.entity.data.glossaryTerm import (
    GlossaryTerm as GlossaryTermEntity,
)
from metadata.sdk.entities.base import BaseEntity


class GlossaryTerm(BaseEntity[GlossaryTermEntity, CreateGlossaryTermRequest]):
    """GlossaryTerm entity operations"""

    _entity_class = GlossaryTermEntity
    _create_request_class = CreateGlossaryTermRequest

    @classmethod
    def entity_type(cls):
        """Return the entity type"""
        return GlossaryTermEntity

    # ============= Asset Management Methods =============

    @classmethod
    def add_assets(
        cls, term_id: str, asset_ids: List[str], asset_types: Optional[List[str]] = None
    ) -> GlossaryTermEntity:
        """
        Add assets to a glossary term.

        Args:
            term_id: GlossaryTerm UUID
            asset_ids: List of asset UUIDs to add
            asset_types: Optional list of asset types

        Returns:
            Updated GlossaryTerm entity
        """
        json_patch = []
        for i, asset_id in enumerate(asset_ids):
            asset_type = (
                asset_types[i] if asset_types and i < len(asset_types) else "table"
            )
            json_patch.append(
                {
                    "op": "add",
                    "path": "/assets/-",
                    "value": {
                        "id": asset_id,
                        "type": asset_type,
                        "fullyQualifiedName": f"{asset_type}.{asset_id}",
                    },
                }
            )
        return cls.patch(term_id, json_patch)

    @classmethod
    def remove_assets(cls, term_id: str, asset_ids: List[str]) -> GlossaryTermEntity:
        """
        Remove assets from a glossary term.

        Args:
            term_id: GlossaryTerm UUID
            asset_ids: List of asset UUIDs to remove

        Returns:
            Updated GlossaryTerm entity
        """
        term = cls.retrieve(term_id, fields=["assets"])

        json_patch = []
        if hasattr(term, "assets") and term.assets:
            for asset_id in asset_ids:
                for i, asset in enumerate(term.assets):
                    if str(asset.id) == asset_id:
                        json_patch.append({"op": "remove", "path": f"/assets/{i}"})
                        break

        return cls.patch(term_id, json_patch) if json_patch else term

    @classmethod
    def add_related_terms(
        cls, term_id: str, related_term_ids: List[str]
    ) -> GlossaryTermEntity:
        """
        Add related glossary terms.

        Args:
            term_id: GlossaryTerm UUID
            related_term_ids: List of related term UUIDs

        Returns:
            Updated GlossaryTerm entity
        """
        json_patch = []
        for related_id in related_term_ids:
            json_patch.append(
                {
                    "op": "add",
                    "path": "/relatedTerms/-",
                    "value": {"id": related_id, "type": "glossaryTerm"},
                }
            )
        return cls.patch(term_id, json_patch)

    @classmethod
    def remove_related_terms(
        cls, term_id: str, related_term_ids: List[str]
    ) -> GlossaryTermEntity:
        """
        Remove related glossary terms.

        Args:
            term_id: GlossaryTerm UUID
            related_term_ids: List of related term UUIDs to remove

        Returns:
            Updated GlossaryTerm entity
        """
        term = cls.retrieve(term_id, fields=["relatedTerms"])

        json_patch = []
        if hasattr(term, "relatedTerms") and term.relatedTerms:
            for related_id in related_term_ids:
                for i, related in enumerate(term.relatedTerms):
                    if str(related.id) == related_id:
                        json_patch.append(
                            {"op": "remove", "path": f"/relatedTerms/{i}"}
                        )
                        break

        return cls.patch(term_id, json_patch) if json_patch else term

    @classmethod
    def add_synonyms(cls, term_id: str, synonyms: List[str]) -> GlossaryTermEntity:
        """
        Add synonyms to a glossary term.

        Args:
            term_id: GlossaryTerm UUID
            synonyms: List of synonym strings

        Returns:
            Updated GlossaryTerm entity
        """
        json_patch = []
        for synonym in synonyms:
            json_patch.append({"op": "add", "path": "/synonyms/-", "value": synonym})
        return cls.patch(term_id, json_patch)

    @classmethod
    def remove_synonyms(cls, term_id: str, synonyms: List[str]) -> GlossaryTermEntity:
        """
        Remove synonyms from a glossary term.

        Args:
            term_id: GlossaryTerm UUID
            synonyms: List of synonyms to remove

        Returns:
            Updated GlossaryTerm entity
        """
        term = cls.retrieve(term_id, fields=["synonyms"])

        json_patch = []
        if hasattr(term, "synonyms") and term.synonyms:
            for synonym in synonyms:
                if synonym in term.synonyms:
                    idx = term.synonyms.index(synonym)
                    json_patch.append({"op": "remove", "path": f"/synonyms/{idx}"})

        return cls.patch(term_id, json_patch) if json_patch else term

    @classmethod
    def set_parent_term(cls, term_id: str, parent_term_id: str) -> GlossaryTermEntity:
        """
        Set parent term for hierarchical glossary.

        Args:
            term_id: GlossaryTerm UUID
            parent_term_id: Parent term UUID

        Returns:
            Updated GlossaryTerm entity
        """
        json_patch = [
            {
                "op": "add",
                "path": "/parent",
                "value": {"id": parent_term_id, "type": "glossaryTerm"},
            }
        ]
        return cls.patch(term_id, json_patch)

    @classmethod
    def add_child_terms(
        cls, parent_term_id: str, child_term_ids: List[str]
    ) -> GlossaryTermEntity:
        """
        Add child terms to a parent term.

        Args:
            parent_term_id: Parent term UUID
            child_term_ids: List of child term UUIDs

        Returns:
            Updated parent GlossaryTerm entity
        """
        json_patch = []
        for child_id in child_term_ids:
            json_patch.append(
                {
                    "op": "add",
                    "path": "/children/-",
                    "value": {"id": child_id, "type": "glossaryTerm"},
                }
            )
        return cls.patch(parent_term_id, json_patch)

    @classmethod
    def get_assets(cls, term_id: str, asset_type: Optional[str] = None) -> List:
        """
        Get all assets associated with a glossary term.

        Args:
            term_id: GlossaryTerm UUID
            asset_type: Optional filter by asset type

        Returns:
            List of assets
        """
        term = cls.retrieve(term_id, fields=["assets"])

        if not hasattr(term, "assets") or not term.assets:
            return []

        if asset_type:
            return [asset for asset in term.assets if asset.type == asset_type]

        return term.assets

    @classmethod
    def add_tables(cls, term_id: str, table_ids: List[str]) -> GlossaryTermEntity:
        """
        Add tables to a glossary term.

        Args:
            term_id: GlossaryTerm UUID
            table_ids: List of table UUIDs

        Returns:
            Updated GlossaryTerm entity
        """
        return cls.add_assets(term_id, table_ids, ["table"] * len(table_ids))

    @classmethod
    def add_columns(cls, term_id: str, column_fqns: List[str]) -> GlossaryTermEntity:
        """
        Add columns to a glossary term.

        Args:
            term_id: GlossaryTerm UUID
            column_fqns: List of column fully qualified names

        Returns:
            Updated GlossaryTerm entity
        """
        json_patch = []
        for column_fqn in column_fqns:
            json_patch.append(
                {
                    "op": "add",
                    "path": "/assets/-",
                    "value": {"type": "column", "fullyQualifiedName": column_fqn},
                }
            )
        return cls.patch(term_id, json_patch)

    @classmethod
    def add_dashboards(
        cls, term_id: str, dashboard_ids: List[str]
    ) -> GlossaryTermEntity:
        """
        Add dashboards to a glossary term.

        Args:
            term_id: GlossaryTerm UUID
            dashboard_ids: List of dashboard UUIDs

        Returns:
            Updated GlossaryTerm entity
        """
        return cls.add_assets(
            term_id, dashboard_ids, ["dashboard"] * len(dashboard_ids)
        )

    @classmethod
    def add_pipelines(cls, term_id: str, pipeline_ids: List[str]) -> GlossaryTermEntity:
        """
        Add pipelines to a glossary term.

        Args:
            term_id: GlossaryTerm UUID
            pipeline_ids: List of pipeline UUIDs

        Returns:
            Updated GlossaryTerm entity
        """
        return cls.add_assets(term_id, pipeline_ids, ["pipeline"] * len(pipeline_ids))

    @classmethod
    def add_metrics(cls, term_id: str, metric_ids: List[str]) -> GlossaryTermEntity:
        """
        Add metrics to a glossary term.

        Args:
            term_id: GlossaryTerm UUID
            metric_ids: List of metric UUIDs

        Returns:
            Updated GlossaryTerm entity
        """
        return cls.add_assets(term_id, metric_ids, ["metric"] * len(metric_ids))

    @classmethod
    def add_reviewers(cls, term_id: str, reviewer_ids: List[str]) -> GlossaryTermEntity:
        """
        Add reviewers to a glossary term.

        Args:
            term_id: GlossaryTerm UUID
            reviewer_ids: List of user UUIDs as reviewers

        Returns:
            Updated GlossaryTerm entity
        """
        json_patch = []
        for reviewer_id in reviewer_ids:
            json_patch.append(
                {
                    "op": "add",
                    "path": "/reviewers/-",
                    "value": {"id": reviewer_id, "type": "user"},
                }
            )
        return cls.patch(term_id, json_patch)
