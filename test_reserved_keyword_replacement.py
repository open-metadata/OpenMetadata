from uuid import uuid4

from metadata.generated.schema.entity.data.table import Table

from metadata.generated.schema.type.basic import EntityName, Uuid

from metadata.ingestion.models.custom_pydantic import RESERVED_COLON_KEYWORD

a = Table(name=EntityName(root="::"), id=Uuid(root=uuid4()), columns=[])

print(a.model_dump_json())

assert a.model_dump()["name"] == RESERVED_COLON_KEYWORD
