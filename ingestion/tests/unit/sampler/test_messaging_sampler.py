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

"""Column naming and value resolution in the messaging sampler.

Column names are the contract with
``AutoClassificationProcessor._find_column_by_dotted_path`` and must not change.
"""

import uuid

import pytest

from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.schema import DataTypeTopic, FieldModel
from metadata.generated.schema.type.schema import Topic as MessageSchema
from metadata.sampler.messaging.sampler import MessagingSampler

# Mirrors what metadata.parsers.avro_parser actually emits: every RECORD level
# contributes the record *type* name as its own path segment -- ``Order`` at the
# root, ``Address`` under the ``shipping`` field -- and none of those segments
# exist in the message on the wire. An earlier version of this fixture omitted
# the nested type name, so no test ever walked a path deeper than the root.
NESTED_FIELDS = [
    FieldModel(
        name="Order",
        dataType=DataTypeTopic.RECORD,
        children=[
            FieldModel(name="order_id", dataType=DataTypeTopic.STRING),
            FieldModel(name="email", dataType=DataTypeTopic.STRING),
            FieldModel(
                name="shipping",
                dataType=DataTypeTopic.RECORD,
                children=[
                    FieldModel(
                        name="Address",
                        dataType=DataTypeTopic.RECORD,
                        children=[
                            FieldModel(name="city", dataType=DataTypeTopic.STRING),
                            FieldModel(name="country", dataType=DataTypeTopic.STRING),
                        ],
                    )
                ],
            ),
        ],
    )
]

FLAT_FIELDS = [
    FieldModel(name="email", dataType=DataTypeTopic.STRING),
    FieldModel(name="ssn", dataType=DataTypeTopic.STRING),
]


class _StubSampler(MessagingSampler):
    """Messaging sampler with the broker replaced by a fixed message list."""

    def __init__(self, entity: Topic, messages: list[dict]):
        super().__init__(service_connection_config=None, ometa_client=None, entity=entity)
        self._messages = messages

    def _fetch_messages(self, count: int) -> list[dict]:
        return self._messages[:count]


def _topic(fields: list[FieldModel]) -> Topic:
    return Topic(
        id=uuid.uuid4(),
        name="om_orders_avro",
        partitions=1,
        service=EntityReference(id=uuid.uuid4(), type="messagingService"),
        messageSchema=MessageSchema(schemaFields=fields),
    )


def _row(sampler: _StubSampler) -> dict:
    table_data = sampler.fetch_sample_data(columns=None)
    return dict(zip([c.root for c in table_data.columns], table_data.rows[0], strict=True))


def test_column_names_keep_the_schema_root_prefix() -> None:
    sampler = _StubSampler(_topic(NESTED_FIELDS), [{}])

    assert [col.name for col in sampler.get_columns()] == [
        "Order.order_id",
        "Order.email",
        "Order.shipping.Address.city",
        "Order.shipping.Address.country",
    ]


def test_unwrapped_message_resolves_against_a_nested_schema() -> None:
    message = {
        "order_id": "o-1",
        "email": "user@example.com",
        "shipping": {"city": "Springfield", "country": "US"},
    }
    sampler = _StubSampler(_topic(NESTED_FIELDS), [message])

    row = _row(sampler)

    assert row["Order.order_id"] == "o-1"
    assert row["Order.email"] == "user@example.com"
    assert row["Order.shipping.Address.city"] == "Springfield"
    assert row["Order.shipping.Address.country"] == "US"


def test_wrapped_message_resolves_past_a_nested_record_type_name() -> None:
    message = {"Order": {"shipping": {"city": "Springfield"}}}
    sampler = _StubSampler(_topic(NESTED_FIELDS), [message])

    assert _row(sampler)["Order.shipping.Address.city"] == "Springfield"


def test_nested_record_carrying_its_type_name_still_resolves() -> None:
    """A producer that does emit the type name must keep working."""
    message = {"shipping": {"Address": {"city": "Shelbyville"}}}
    sampler = _StubSampler(_topic(NESTED_FIELDS), [message])

    assert _row(sampler)["Order.shipping.Address.city"] == "Shelbyville"


def test_absent_nested_leaf_is_none_not_its_container() -> None:
    """Skipping absent segments must never let a leaf resolve to the dict above it."""
    sampler = _StubSampler(_topic(NESTED_FIELDS), [{"shipping": {"country": "US"}}])

    assert _row(sampler)["Order.shipping.Address.city"] is None


def test_wrapped_message_still_resolves_on_the_full_path() -> None:
    message = {"Order": {"order_id": "o-2", "email": "other@example.com"}}
    sampler = _StubSampler(_topic(NESTED_FIELDS), [message])

    row = _row(sampler)

    assert row["Order.order_id"] == "o-2"
    assert row["Order.email"] == "other@example.com"


def test_full_path_wins_when_both_shapes_are_present() -> None:
    message = {"email": "unwrapped@example.com", "Order": {"email": "wrapped@example.com"}}
    sampler = _StubSampler(_topic(NESTED_FIELDS), [message])

    assert _row(sampler)["Order.email"] == "wrapped@example.com"


def test_flat_schema_is_unaffected() -> None:
    message = {"email": "user@example.com", "ssn": "123-45-6789"}
    sampler = _StubSampler(_topic(FLAT_FIELDS), [message])

    row = _row(sampler)

    assert row["email"] == "user@example.com"
    assert row["ssn"] == "123-45-6789"


def test_explicit_null_does_not_inherit_a_same_named_sibling() -> None:
    message = {"email": "sibling@example.com", "Order": {"email": None}}
    sampler = _StubSampler(_topic(NESTED_FIELDS), [message])

    assert _row(sampler)["Order.email"] is None


def test_absent_field_stays_none() -> None:
    sampler = _StubSampler(_topic(NESTED_FIELDS), [{"order_id": "o-3"}])

    assert _row(sampler)["Order.email"] is None


@pytest.mark.parametrize("fields", [[], None])
def test_topic_without_schema_fields_yields_no_columns(fields) -> None:
    sampler = _StubSampler(_topic(fields), [{"email": "user@example.com"}])

    assert sampler.get_columns() == []
    assert sampler.fetch_sample_data(columns=None).rows == []
