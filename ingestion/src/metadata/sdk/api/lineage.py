"""
Lineage API with fluent interface
"""
import asyncio
from typing import ClassVar, Dict, List, Optional, Union

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.type.entityLineage import EntityLineage
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.ometa_api import OpenMetadata as OMeta
from metadata.sdk.client import OpenMetadata


class Lineage:
    """Static fluent API for lineage operations"""

    _default_client: ClassVar[Optional[OMeta]] = None

    @classmethod
    def set_default_client(cls, client: Union[OpenMetadata, OMeta]):
        """Set the default client for static methods"""
        if isinstance(client, OpenMetadata):
            cls._default_client = client.ometa
        else:
            cls._default_client = client

    @classmethod
    def _get_client(cls) -> OMeta:
        """Get the default client"""
        if cls._default_client is None:
            cls._default_client = OpenMetadata.get_default_client()
        return cls._default_client

    @classmethod
    def get_lineage(
        cls,
        entity: str,
        upstream_depth: int = 1,
        downstream_depth: int = 1,
    ) -> EntityLineage:
        """Get lineage for an entity by FQN"""
        client = cls._get_client()
        return client.get_lineage_by_name(
            entity=entity,
            up_depth=upstream_depth,
            down_depth=downstream_depth,
        )

    @classmethod
    def get_entity_lineage(
        cls,
        entity_type: str,
        entity_id: str,
        upstream_depth: int = 1,
        downstream_depth: int = 1,
    ) -> EntityLineage:
        """Get lineage for an entity by type and ID"""
        client = cls._get_client()
        return client.get_lineage_by_id(
            entity_id=entity_id,
            up_depth=upstream_depth,
            down_depth=downstream_depth,
        )

    @classmethod
    def add_lineage(
        cls,
        from_entity_id: str,
        from_entity_type: str,
        to_entity_id: str,
        to_entity_type: str,
        description: Optional[str] = None,
    ) -> Dict:
        """Add lineage between two entities"""
        client = cls._get_client()
        
        lineage_request = AddLineageRequest(
            edge={
                "fromEntity": EntityReference(
                    id=from_entity_id,
                    type=from_entity_type,
                ),
                "toEntity": EntityReference(
                    id=to_entity_id,
                    type=to_entity_type,
                ),
                "description": description,
            }
        )
        
        return client.add_lineage(lineage_request)

    @classmethod
    def add_lineage_request(cls, lineage_request: AddLineageRequest) -> Dict:
        """Add lineage using a request object"""
        client = cls._get_client()
        return client.add_lineage(lineage_request)

    @classmethod
    def delete_lineage(
        cls,
        from_entity: str,
        from_entity_type: str,
        to_entity: str,
        to_entity_type: str,
    ) -> None:
        """Delete lineage between two entities"""
        client = cls._get_client()
        client.delete_lineage_edge(
            from_entity=from_entity,
            from_entity_type=from_entity_type,
            to_entity=to_entity,
            to_entity_type=to_entity_type,
        )

    @classmethod
    def export_lineage(
        cls,
        entity_type: str,
        entity_id: str,
        upstream_depth: int = 3,
        downstream_depth: int = 3,
    ) -> Dict:
        """Export lineage for an entity"""
        lineage = cls.get_entity_lineage(
            entity_type=entity_type,
            entity_id=entity_id,
            upstream_depth=upstream_depth,
            downstream_depth=downstream_depth,
        )
        return lineage.dict() if hasattr(lineage, 'dict') else lineage.__dict__

    @classmethod
    async def get_lineage_async(
        cls,
        entity: str,
        upstream_depth: int = 1,
        downstream_depth: int = 1,
    ) -> EntityLineage:
        """Async get lineage"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, cls.get_lineage, entity, upstream_depth, downstream_depth
        )

    @classmethod
    async def get_entity_lineage_async(
        cls,
        entity_type: str,
        entity_id: str,
        upstream_depth: int = 1,
        downstream_depth: int = 1,
    ) -> EntityLineage:
        """Async get entity lineage"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, cls.get_entity_lineage, entity_type, entity_id, upstream_depth, downstream_depth
        )

    @classmethod
    async def add_lineage_async(
        cls,
        from_entity_id: str,
        from_entity_type: str,
        to_entity_id: str,
        to_entity_type: str,
        description: Optional[str] = None,
    ) -> Dict:
        """Async add lineage"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, cls.add_lineage, from_entity_id, from_entity_type, to_entity_id, to_entity_type, description
        )

    @classmethod
    async def delete_lineage_async(
        cls,
        from_entity: str,
        from_entity_type: str,
        to_entity: str,
        to_entity_type: str,
    ) -> None:
        """Async delete lineage"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, cls.delete_lineage, from_entity, from_entity_type, to_entity, to_entity_type
        )

    @classmethod
    async def export_lineage_async(
        cls,
        entity_type: str,
        entity_id: str,
        upstream_depth: int = 3,
        downstream_depth: int = 3,
    ) -> Dict:
        """Async export lineage"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, cls.export_lineage, entity_type, entity_id, upstream_depth, downstream_depth
        )

    @classmethod
    def builder(cls) -> "LineageBuilder":
        """Create a lineage builder"""
        return LineageBuilder()


class LineageBuilder:
    """Builder for lineage operations"""

    def __init__(self):
        self._entity = None
        self._entity_type = None
        self._entity_id = None
        self._upstream_depth = 1
        self._downstream_depth = 1
        self._from_entity_id = None
        self._from_entity_type = None
        self._to_entity_id = None
        self._to_entity_type = None
        self._description = None

    def entity(self, entity: str):
        """Set entity FQN"""
        self._entity = entity
        return self

    def entity_type(self, entity_type: str):
        """Set entity type"""
        self._entity_type = entity_type
        return self

    def entity_id(self, entity_id: str):
        """Set entity ID"""
        self._entity_id = entity_id
        return self

    def upstream_depth(self, depth: int):
        """Set upstream depth"""
        self._upstream_depth = depth
        return self

    def downstream_depth(self, depth: int):
        """Set downstream depth"""
        self._downstream_depth = depth
        return self

    def from_entity(self, entity_id: str, entity_type: str):
        """Set source entity"""
        self._from_entity_id = entity_id
        self._from_entity_type = entity_type
        return self

    def to_entity(self, entity_id: str, entity_type: str):
        """Set target entity"""
        self._to_entity_id = entity_id
        self._to_entity_type = entity_type
        return self

    def description(self, description: str):
        """Set lineage description"""
        self._description = description
        return self

    def execute(self) -> Union[EntityLineage, Dict]:
        """Execute the lineage operation"""
        if self._from_entity_id and self._to_entity_id:
            return Lineage.add_lineage(
                from_entity_id=self._from_entity_id,
                from_entity_type=self._from_entity_type,
                to_entity_id=self._to_entity_id,
                to_entity_type=self._to_entity_type,
                description=self._description,
            )
        elif self._entity:
            return Lineage.get_lineage(
                entity=self._entity,
                upstream_depth=self._upstream_depth,
                downstream_depth=self._downstream_depth,
            )
        elif self._entity_type and self._entity_id:
            return Lineage.get_entity_lineage(
                entity_type=self._entity_type,
                entity_id=self._entity_id,
                upstream_depth=self._upstream_depth,
                downstream_depth=self._downstream_depth,
            )
        else:
            raise ValueError("Either entity or entity_type/entity_id must be set")

    async def execute_async(self) -> Union[EntityLineage, Dict]:
        """Execute the lineage operation asynchronously"""
        if self._from_entity_id and self._to_entity_id:
            return await Lineage.add_lineage_async(
                from_entity_id=self._from_entity_id,
                from_entity_type=self._from_entity_type,
                to_entity_id=self._to_entity_id,
                to_entity_type=self._to_entity_type,
                description=self._description,
            )
        elif self._entity:
            return await Lineage.get_lineage_async(
                entity=self._entity,
                upstream_depth=self._upstream_depth,
                downstream_depth=self._downstream_depth,
            )
        elif self._entity_type and self._entity_id:
            return await Lineage.get_entity_lineage_async(
                entity_type=self._entity_type,
                entity_id=self._entity_id,
                upstream_depth=self._upstream_depth,
                downstream_depth=self._downstream_depth,
            )
        else:
            raise ValueError("Either entity or entity_type/entity_id must be set")