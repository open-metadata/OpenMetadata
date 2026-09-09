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
Test the shared topic field FQN resolver
"""

from unittest.mock import Mock

from metadata.ingestion.lineage.topic_lineage import (
    CDC_ENVELOPE_FIELDS,
    get_topic_field_fqn,
)


def _field(name, fqn=None, children=None):
    field = Mock()
    field.name = name
    field.fullyQualifiedName = Mock(root=fqn) if fqn else None
    field.children = children
    return field


def _topic(name, schema_fields):
    topic = Mock()
    topic.name = name
    topic.messageSchema = Mock(schemaFields=schema_fields, schemaText=None)
    return topic


class TestGetTopicFieldFqn:
    def test_cdc_envelope_fields_constant(self):
        assert {"after", "before", "op"} == CDC_ENVELOPE_FIELDS

    def test_no_message_schema_returns_none(self):
        topic = Mock()
        topic.name = "t"
        topic.messageSchema = None
        assert get_topic_field_fqn(topic, "col") is None

    def test_direct_field_match(self):
        topic = _topic("t", [_field("col", "svc.t.col")])
        assert get_topic_field_fqn(topic, "col") == "svc.t.col"

    def test_nested_child_match(self):
        child = _field("col", "svc.t.rec.col")
        topic = _topic("t", [_field("rec", "svc.t.rec", children=[child])])
        assert get_topic_field_fqn(topic, "col") == "svc.t.rec.col"

    def test_cdc_prefers_after_over_before(self):
        after = _field("after", "svc.t.env.after", children=[_field("id", "svc.t.env.after.id")])
        before = _field("before", "svc.t.env.before", children=[_field("id", "svc.t.env.before.id")])
        topic = _topic("t", [_field("env", "svc.t.env", children=[after, before])])
        assert get_topic_field_fqn(topic, "id") == "svc.t.env.after.id"

    def test_unknown_field_returns_none(self):
        topic = _topic("t", [_field("col", "svc.t.col")])
        assert get_topic_field_fqn(topic, "missing") is None
