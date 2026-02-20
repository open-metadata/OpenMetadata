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
OpenMetadata high-level API EventSubscription test
"""
from copy import deepcopy
from unittest.mock import patch

import pytest
from pydantic import ValidationError

from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.events.api.createEventSubscription import (
    CreateEventSubscription,
)
from metadata.generated.schema.events.eventSubscription import (
    AlertType,
    Destination,
    EventSubscription,
    SubscriptionCategory,
    SubscriptionType,
)
from metadata.generated.schema.type.basic import EntityName
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.ometa.client import REST

from ..integration_base import generate_name

# Mock response with invalid EventSubscription data
BAD_SUBSCRIPTION_RESPONSE = {
    "data": [
        {
            "id": "cb149dd4-f4c2-485e-acd3-74b7dca1015e",
            "name": "valid-subscription",
            "alertType": "Notification",
            "destinations": [
                {
                    "category": "External",
                    "type": "Webhook",
                    "config": {"endpoint": "https://example.com/webhook"},
                }
            ],
        },
        {
            "id": "5d76676c-8e94-4e7e-97b8-294f4c16d0aa",
            "name": "another-valid-subscription",
            "alertType": "Notification",
            "destinations": [
                {
                    "category": "External",
                    "type": "Webhook",
                    "config": {"endpoint": "https://example.com/webhook2"},
                }
            ],
        },
        {
            "id": "f063ff4e-99a3-4d42-8678-c484c2556e8d",
            "name": "invalid-subscription",
            "alertType": "Invalid-Type",  # Invalid enum value
            "destinations": [
                {
                    "category": "External",
                    "type": "Webhook",
                    "config": {"endpoint": "https://example.com/webhook3"},
                }
            ],
        },
    ],
    "paging": {
        "total": 3,
    },
}


@pytest.fixture(scope="module")
def subscription_user(metadata):
    """Create a user for subscription ownership tests."""
    user_name = generate_name()
    user = metadata.create_or_update(
        data=CreateUserRequest(name=user_name, email=f"{user_name.root}@test.com"),
    )

    yield user

    metadata.delete(entity=User, entity_id=user.id, hard_delete=True)


@pytest.fixture(scope="module")
def subscription_owners(subscription_user):
    """Owner reference list for subscription tests."""
    return EntityReferenceList(
        root=[EntityReference(id=subscription_user.id, type="user")]
    )


@pytest.fixture
def subscription_request():
    """Create a subscription request with a unique name."""
    name = generate_name()
    return CreateEventSubscription(
        name=name,
        description="Test event subscription for integration testing",
        alertType=AlertType.Notification,
        resources=["All"],
        destinations=[
            Destination(
                category=SubscriptionCategory.External,
                type=SubscriptionType.Webhook,
                config={"endpoint": "https://example.com/test-webhook"},
            )
        ],
        enabled=True,
        batchSize=50,
        retries=3,
        pollInterval=30,
    )


@pytest.fixture
def create_subscription(metadata, request):
    """Factory fixture for creating subscriptions with automatic cleanup."""
    subscriptions = []

    def _create_subscription(create_request):
        subscription = metadata.create_or_update(data=create_request)
        subscriptions.append(subscription)
        return subscription

    def teardown():
        for sub in subscriptions:
            metadata.delete(
                entity=EventSubscription,
                entity_id=sub.id,
                hard_delete=True,
            )

    request.addfinalizer(teardown)

    return _create_subscription


class TestOMetaSubscriptionAPI:
    """
    EventSubscription API integration tests.
    Tests CRUD operations, pagination, and configuration options.

    Uses fixtures from conftest:
    - metadata: OpenMetadata client (session scope)
    """

    def test_create(self, metadata, subscription_request, create_subscription):
        """
        We can create an EventSubscription and we receive it back as Entity
        """
        res = create_subscription(subscription_request)
        assert res.name == subscription_request.name
        assert res.alertType == subscription_request.alertType
        assert len(res.destinations) == 1
        assert res.enabled is True
        assert res.batchSize == 50

    def test_get_name(self, metadata, subscription_request, create_subscription):
        """
        We can fetch an EventSubscription by name and get it back as Entity
        """
        created = create_subscription(subscription_request)

        res = metadata.get_by_name(
            entity=EventSubscription, fqn=subscription_request.name.root
        )
        assert res.name == created.name

    def test_get_id(self, metadata, subscription_request, create_subscription):
        """
        We can fetch an EventSubscription by ID and get it back as Entity
        """
        created = create_subscription(subscription_request)

        res_name = metadata.get_by_name(
            entity=EventSubscription, fqn=subscription_request.name.root
        )
        res = metadata.get_by_id(entity=EventSubscription, entity_id=res_name.id)
        assert res_name.id == res.id

    def test_list(self, metadata, subscription_request, create_subscription):
        """
        We can list all our EventSubscriptions
        """
        created = create_subscription(subscription_request)

        res = metadata.list_entities(entity=EventSubscription)

        data = next(
            iter(ent for ent in res.entities if ent.name == created.name),
            None,
        )
        assert data

    def test_list_all_and_paginate(
        self, metadata, subscription_request, create_subscription
    ):
        """
        Validate generator utility to fetch all event subscriptions
        """
        base_name = subscription_request.name.root
        for i in range(0, 10):
            fake_create = deepcopy(subscription_request)
            fake_create.name = EntityName(base_name + str(i))
            create_subscription(fake_create)

        all_entities = metadata.list_all_entities(entity=EventSubscription, limit=2)
        assert len(list(all_entities)) >= 10

        entity_list = metadata.list_entities(entity=EventSubscription, limit=2)
        assert len(entity_list.entities) == 2
        after_entity_list = metadata.list_entities(
            entity=EventSubscription, limit=2, after=entity_list.after
        )
        assert len(after_entity_list.entities) == 2
        before_entity_list = metadata.list_entities(
            entity=EventSubscription, limit=2, before=after_entity_list.before
        )
        assert before_entity_list.entities == entity_list.entities

    def test_delete(self, metadata, subscription_request):
        """
        We can delete an EventSubscription by ID
        """
        subscription = metadata.create_or_update(data=subscription_request)

        res_name = metadata.get_by_name(
            entity=EventSubscription, fqn=subscription.fullyQualifiedName
        )
        res_id = metadata.get_by_id(entity=EventSubscription, entity_id=res_name.id)

        metadata.delete(entity=EventSubscription, entity_id=str(res_id.id.root))

        res = metadata.list_entities(entity=EventSubscription)
        assert not next(
            iter(
                ent
                for ent in res.entities
                if ent.fullyQualifiedName == subscription.fullyQualifiedName
            ),
            None,
        )

    def test_update(
        self,
        metadata,
        subscription_request,
        subscription_user,
        subscription_owners,
        create_subscription,
    ):
        """
        Updating it properly changes its properties
        """
        res_create = create_subscription(subscription_request)

        updated = subscription_request.model_dump(exclude_unset=True)
        updated["owners"] = subscription_owners
        updated["description"] = "Updated description"
        updated["batchSize"] = 100
        updated_entity = CreateEventSubscription(**updated)

        res = metadata.create_or_update(data=updated_entity)

        assert res_create.id == res.id
        assert res.owners.root[0].id == subscription_user.id
        assert res.description.root == "Updated description"
        assert res.batchSize == 100

    def test_list_versions(self, metadata, subscription_request, create_subscription):
        """
        test list event subscription entity versions
        """
        subscription = create_subscription(subscription_request)

        res = metadata.get_list_entity_versions(
            entity=EventSubscription, entity_id=subscription.id.root
        )
        assert res

    def test_get_entity_version(
        self, metadata, subscription_request, create_subscription
    ):
        """
        test get event subscription entity version
        """
        subscription = create_subscription(subscription_request)

        res = metadata.get_entity_version(
            entity=EventSubscription,
            entity_id=subscription.id.root,
            version=0.1,
        )

        assert res.version.root == 0.1
        assert res.id == subscription.id

    def test_get_entity_ref(self, metadata, subscription_request, create_subscription):
        """
        test get EventSubscription EntityReference
        """
        subscription = create_subscription(subscription_request)
        entity_ref = metadata.get_entity_reference(
            entity=EventSubscription, fqn=subscription.fullyQualifiedName
        )

        assert subscription.id == entity_ref.id

    def test_list_w_skip_on_failure(self, metadata):
        """
        We can list all our EventSubscriptions even when some of them are broken
        """
        with patch.object(REST, "get", return_value=BAD_SUBSCRIPTION_RESPONSE):
            with pytest.raises(ValidationError):
                metadata.list_entities(entity=EventSubscription)

        with patch.object(REST, "get", return_value=BAD_SUBSCRIPTION_RESPONSE):
            res = metadata.list_entities(entity=EventSubscription, skip_on_failure=True)

        assert len(res.entities) == 2

    def test_list_all_w_skip_on_failure(self, metadata):
        """
        Validate generator utility to fetch all event subscriptions even when some are broken
        """
        with patch.object(REST, "get", return_value=BAD_SUBSCRIPTION_RESPONSE):
            with pytest.raises(ValidationError):
                res = metadata.list_all_entities(
                    entity=EventSubscription,
                    limit=1,
                )
                list(res)

        with patch.object(REST, "get", return_value=BAD_SUBSCRIPTION_RESPONSE):
            res = metadata.list_all_entities(
                entity=EventSubscription,
                limit=1,
                skip_on_failure=True,
            )

            assert len(list(res)) == 2

    def test_subscription_with_slash_in_name(self, metadata):
        """E.g., `subscription.name/with-slash`"""
        name = EntityName("subscription.name/with-slash")
        create_request = CreateEventSubscription(
            name=name,
            description="Event subscription with slash in name",
            alertType=AlertType.Notification,
            resources=["All"],
            destinations=[
                Destination(
                    category=SubscriptionCategory.External,
                    type=SubscriptionType.Webhook,
                    config={"endpoint": "https://example.com/slash-webhook"},
                )
            ],
        )
        new_subscription: EventSubscription = metadata.create_or_update(
            data=create_request
        )

        res: EventSubscription = metadata.get_by_name(
            entity=EventSubscription, fqn=new_subscription.fullyQualifiedName
        )

        assert res.name == name

        metadata.delete(
            entity=EventSubscription,
            entity_id=new_subscription.id,
            hard_delete=True,
        )

    def test_different_alert_types(self, metadata):
        """
        Test creating subscriptions with different alert types
        """
        alert_types = [
            AlertType.Notification,
            AlertType.Observability,
        ]

        created_subscriptions = []

        for alert_type in alert_types:
            create_request = CreateEventSubscription(
                name=f"test-{alert_type.value.lower()}-subscription",
                description=f"Test {alert_type.value} subscription",
                alertType=alert_type,
                resources=["table"],
                destinations=[
                    Destination(
                        category=SubscriptionCategory.External,
                        type=SubscriptionType.Webhook,
                        config={
                            "endpoint": f"https://example.com/{alert_type.value.lower()}-webhook"
                        },
                    )
                ],
            )

            subscription = metadata.create_or_update(data=create_request)
            created_subscriptions.append(subscription)

            assert subscription.alertType == alert_type

        for subscription in created_subscriptions:
            metadata.delete(
                entity=EventSubscription,
                entity_id=subscription.id,
                hard_delete=True,
            )

    def test_different_destination_types(self, metadata):
        """
        Test creating subscriptions with different destination types
        """
        destination_configs = [
            {
                "type": SubscriptionType.Webhook,
                "config": {"endpoint": "https://example.com/webhook"},
            },
            {
                "type": SubscriptionType.Email,
                "config": {"receivers": ["test@example.com"]},
            },
        ]

        created_subscriptions = []

        for dest_config in destination_configs:
            create_request = CreateEventSubscription(
                name=f"test-{dest_config['type'].value.lower()}-destination",
                description=f"Test {dest_config['type'].value} destination",
                alertType=AlertType.Notification,
                resources=["All"],
                destinations=[
                    Destination(
                        category=SubscriptionCategory.External,
                        type=dest_config["type"],
                        config=dest_config["config"],
                    )
                ],
            )

            subscription = metadata.create_or_update(data=create_request)
            created_subscriptions.append(subscription)

            assert subscription.destinations[0].type == dest_config["type"]

        for subscription in created_subscriptions:
            metadata.delete(
                entity=EventSubscription,
                entity_id=subscription.id,
                hard_delete=True,
            )

    def test_subscription_configuration_options(self, metadata):
        """
        Test various configuration options for event subscriptions
        """
        create_request = CreateEventSubscription(
            name="test-config-subscription",
            description="Test subscription with custom configuration",
            alertType=AlertType.Observability,
            resources=["table"],
            destinations=[
                Destination(
                    category=SubscriptionCategory.External,
                    type=SubscriptionType.Webhook,
                    config={
                        "endpoint": "https://example.com/config-webhook",
                        "headers": {"Authorization": "Bearer token123"},
                    },
                    timeout=15,
                    readTimeout=20,
                    enabled=True,
                )
            ],
            enabled=True,
            batchSize=25,
            retries=5,
            pollInterval=60,
        )

        subscription = metadata.create_or_update(data=create_request)

        assert subscription.alertType == AlertType.Observability
        assert subscription.batchSize == 25
        assert subscription.retries == 5
        assert subscription.pollInterval == 60
        assert subscription.destinations[0].timeout == 15
        assert subscription.destinations[0].readTimeout == 20

        metadata.delete(
            entity=EventSubscription,
            entity_id=subscription.id,
            hard_delete=True,
        )
