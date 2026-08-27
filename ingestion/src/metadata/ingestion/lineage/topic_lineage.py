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
Helpers to resolve fields inside a Topic's message schema.

Topic-side counterpart to get_column_fqn: Topics expose their fields under
messageSchema.schemaFields rather than a flat `columns` list, and Debezium
wraps the real record under an after/before envelope.
"""

from typing import Optional

from metadata.generated.schema.entity.data.topic import Topic
from metadata.ingestion.ometa.utils import model_str
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

CDC_ENVELOPE_FIELDS = {"after", "before", "op"}


def get_topic_field_fqn(
    topic_entity: Topic, field_name: str
) -> Optional[str]:  # noqa: C901, UP045
    """
    Get the fully qualified name for a field in a Topic's schema.
    Handles nested structures where fields may be children of a parent RECORD.
    For Debezium CDC topics, searches for fields inside after/before envelope children.
    """
    if not topic_entity.messageSchema or not topic_entity.messageSchema.schemaFields:
        logger.debug(f"Topic {model_str(topic_entity.name)} has no message schema")
        return None

    for field in topic_entity.messageSchema.schemaFields:
        field_name_str = model_str(field.name)

        if field_name_str == field_name:
            return field.fullyQualifiedName.root if field.fullyQualifiedName else None

        if field.children:
            after_child = None
            before_child = None

            for child in field.children:
                child_name = model_str(child.name)
                if child_name == "after":
                    after_child = child
                elif child_name == "before":
                    before_child = child
                if child_name == field_name:
                    return (
                        child.fullyQualifiedName.root
                        if child.fullyQualifiedName
                        else None
                    )

            # Debezium: 'after' holds post-change state, prefer it over 'before'
            for cdc_child in [after_child, before_child]:
                if cdc_child and cdc_child.children:
                    for grandchild in cdc_child.children:
                        if model_str(grandchild.name) == field_name:
                            return (
                                grandchild.fullyQualifiedName.root
                                if grandchild.fullyQualifiedName
                                else None
                            )

            for child in field.children:
                if child not in [after_child, before_child] and child.children:
                    for grandchild in child.children:
                        if model_str(grandchild.name) == field_name:
                            return (
                                grandchild.fullyQualifiedName.root
                                if grandchild.fullyQualifiedName
                                else None
                            )

    # CDC columns may exist only in schemaText, not as field objects
    for field in topic_entity.messageSchema.schemaFields:
        field_name_str = model_str(field.name)
        if "Envelope" in field_name_str and field.fullyQualifiedName:
            envelope_fqn = field.fullyQualifiedName.root
            return f"{envelope_fqn}.{field_name}"

    logger.debug(
        f"Field {field_name} not found in topic {model_str(topic_entity.name)} schema"
    )
    return None
