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
from unittest import TestCase
from unittest.mock import patch

import pytest
from pydantic import ValidationError

from _openmetadata_testutils.ometa import int_admin_ometa
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
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


class OMetaSubscriptionTest(TestCase):
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

    metadata = int_admin_ometa()

    user = metadata.create_or_update(
        data=CreateUserRequest(name="subscription-user", email="subscription@test.com"),
    )
    owners = EntityReferenceList(root=[EntityReference(id=user.id, type="user")])

    create_subscription = CreateEventSubscription(
        name="test-subscription",
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

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare ingredients
        """
        cls.metadata.create_or_update(data=cls.create_subscription)

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up
        """
        subscription: EventSubscription = cls.metadata.get_by_name(
            entity=EventSubscription, fqn=cls.create_subscription.name.root
        )

        if subscription:
            cls.metadata.delete(
                entity=EventSubscription,
                entity_id=subscription.id,
                recursive=True,
                hard_delete=True,
            )

        cls.metadata.delete(
            entity=cls.user.__class__,
            entity_id=cls.user.id,
            recursive=True,
            hard_delete=True,
        )

    def test_create(self):
        """
        We can create an EventSubscription and we receive it back as Entity
        """
        res = self.metadata.create_or_update(data=self.create_subscription)
        self.assertEqual(res.name, self.create_subscription.name)
        self.assertEqual(res.alertType, self.create_subscription.alertType)
        self.assertEqual(len(res.destinations), 1)
        self.assertEqual(res.enabled, True)
        self.assertEqual(res.batchSize, 50)

    def test_get_name(self):
        """
        We can fetch an EventSubscription by name and get it back as Entity
        """
        res = self.metadata.get_by_name(
            entity=EventSubscription, fqn=self.create_subscription.name.root
        )
        self.assertEqual(res.name, self.create_subscription.name)

    def test_get_id(self):
        """
        We can fetch an EventSubscription by ID and get it back as Entity
        """
        # First get by name
        res_name = self.metadata.get_by_name(
            entity=EventSubscription, fqn=self.create_subscription.name.root
        )
        # Then fetch by ID
        res = self.metadata.get_by_id(entity=EventSubscription, entity_id=res_name.id)
        self.assertEqual(res_name.id, res.id)

    def test_list(self):
        """
        We can list all our EventSubscriptions
        """
        res = self.metadata.list_entities(entity=EventSubscription)

        # Fetch our test EventSubscription. We have already inserted it, so we should find it
        data = next(
            iter(
                ent for ent in res.entities if ent.name == self.create_subscription.name
            ),
            None,
        )
        assert data

    def test_list_all_and_paginate(self):
        """
        Validate generator utility to fetch all event subscriptions
        """
        fake_create = deepcopy(self.create_subscription)
        for i in range(0, 10):
            fake_create.name = EntityName(self.create_subscription.name.root + str(i))
            self.metadata.create_or_update(data=fake_create)

        all_entities = self.metadata.list_all_entities(
            entity=EventSubscription, limit=2  # paginate in batches of pairs
        )
        assert (
            len(list(all_entities)) >= 10
        )  # In case the default testing entity is not present

        entity_list = self.metadata.list_entities(entity=EventSubscription, limit=2)
        assert len(entity_list.entities) == 2
        after_entity_list = self.metadata.list_entities(
            entity=EventSubscription, limit=2, after=entity_list.after
        )
        assert len(after_entity_list.entities) == 2
        before_entity_list = self.metadata.list_entities(
            entity=EventSubscription, limit=2, before=after_entity_list.before
        )
        assert before_entity_list.entities == entity_list.entities

    def test_delete(self):
        """
        We can delete an EventSubscription by ID
        """
        # Create a subscription to delete
        delete_subscription = CreateEventSubscription(
            name="test-delete-subscription",
            alertType=AlertType.Notification,
            resources=["All"],
            destinations=[
                Destination(
                    category=SubscriptionCategory.External,
                    type=SubscriptionType.Webhook,
                    config={"endpoint": "https://example.com/delete-webhook"},
                )
            ],
        )
        subscription = self.metadata.create_or_update(data=delete_subscription)

        # Find by name
        res_name = self.metadata.get_by_name(
            entity=EventSubscription, fqn=subscription.fullyQualifiedName
        )
        # Then fetch by ID
        res_id = self.metadata.get_by_id(
            entity=EventSubscription, entity_id=res_name.id
        )

        # Delete
        self.metadata.delete(entity=EventSubscription, entity_id=str(res_id.id.root))

        # Then we should not find it
        res = self.metadata.list_entities(entity=EventSubscription)
        assert not next(
            iter(
                ent
                for ent in res.entities
                if ent.fullyQualifiedName == subscription.fullyQualifiedName
            ),
            None,
        )

    def test_update(self):
        """
        Updating it properly changes its properties
        """
        res_create = self.metadata.create_or_update(data=self.create_subscription)

        updated = self.create_subscription.model_dump(exclude_unset=True)
        updated["owners"] = self.owners
        updated["description"] = "Updated description"
        updated["batchSize"] = 100
        updated_entity = CreateEventSubscription(**updated)

        res = self.metadata.create_or_update(data=updated_entity)

        # Same ID, updated properties
        self.assertEqual(res_create.id, res.id)
        self.assertEqual(res.owners.root[0].id, self.user.id)
        self.assertEqual(res.description.root, "Updated description")
        self.assertEqual(res.batchSize, 100)

    def test_list_versions(self):
        """
        test list event subscription entity versions
        """
        subscription = self.metadata.create_or_update(data=self.create_subscription)

        res = self.metadata.get_list_entity_versions(
            entity=EventSubscription, entity_id=subscription.id.root
        )
        assert res

    def test_get_entity_version(self):
        """
        test get event subscription entity version
        """
        subscription = self.metadata.create_or_update(data=self.create_subscription)

        res = self.metadata.get_entity_version(
            entity=EventSubscription, entity_id=subscription.id.root, version=0.1
        )

        # check we get the correct version requested and the correct entity ID
        assert res.version.root == 0.1
        assert res.id == subscription.id

    def test_get_entity_ref(self):
        """
        test get EventSubscription EntityReference
        """
        subscription = self.metadata.create_or_update(data=self.create_subscription)
        entity_ref = self.metadata.get_entity_reference(
            entity=EventSubscription, fqn=subscription.fullyQualifiedName
        )

        assert subscription.id == entity_ref.id

    def test_list_w_skip_on_failure(self):
        """
        We can list all our EventSubscriptions even when some of them are broken
        """
        # first validate that exception is raised when skip_on_failure is False
        with patch.object(REST, "get", return_value=BAD_SUBSCRIPTION_RESPONSE):
            with pytest.raises(ValidationError):
                self.metadata.list_entities(entity=EventSubscription)

        with patch.object(REST, "get", return_value=BAD_SUBSCRIPTION_RESPONSE):
            res = self.metadata.list_entities(
                entity=EventSubscription, skip_on_failure=True
            )

        # We should have 2 subscriptions, the 3rd one is broken and should be skipped
        assert len(res.entities) == 2

    def test_list_all_w_skip_on_failure(self):
        """
        Validate generator utility to fetch all event subscriptions even when some are broken
        """
        # first validate that exception is raised when skip_on_failure is False
        with patch.object(REST, "get", return_value=BAD_SUBSCRIPTION_RESPONSE):
            with pytest.raises(ValidationError):
                res = self.metadata.list_all_entities(
                    entity=EventSubscription,
                    limit=1,  # paginate in batches of pairs
                )
                list(res)

        with patch.object(REST, "get", return_value=BAD_SUBSCRIPTION_RESPONSE):
            res = self.metadata.list_all_entities(
                entity=EventSubscription,
                limit=1,
                skip_on_failure=True,  # paginate in batches of pairs
            )

            # We should have 2 subscriptions, the 3rd one is broken and should be skipped
            assert len(list(res)) == 2

    def test_subscription_with_slash_in_name(self):
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
        new_subscription: EventSubscription = self.metadata.create_or_update(
            data=create_request
        )

        res: EventSubscription = self.metadata.get_by_name(
            entity=EventSubscription, fqn=new_subscription.fullyQualifiedName
        )

        assert res.name == name

        # Clean up
        self.metadata.delete(
            entity=EventSubscription, entity_id=new_subscription.id, hard_delete=True
        )

    def test_different_alert_types(self):
        """
        Test creating subscriptions with different alert types
        """
        alert_types = [
            AlertType.Notification,
            AlertType.Observability,
        ]

        created_subscriptions = []

        for i, alert_type in enumerate(alert_types):
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

            subscription = self.metadata.create_or_update(data=create_request)
            created_subscriptions.append(subscription)

            # Verify the alert type was set correctly
            self.assertEqual(subscription.alertType, alert_type)

        # Clean up
        for subscription in created_subscriptions:
            self.metadata.delete(
                entity=EventSubscription, entity_id=subscription.id, hard_delete=True
            )

    def test_different_destination_types(self):
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

        for i, dest_config in enumerate(destination_configs):
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

            subscription = self.metadata.create_or_update(data=create_request)
            created_subscriptions.append(subscription)

            # Verify the destination type was set correctly
            self.assertEqual(subscription.destinations[0].type, dest_config["type"])

        # Clean up
        for subscription in created_subscriptions:
            self.metadata.delete(
                entity=EventSubscription, entity_id=subscription.id, hard_delete=True
            )

    def test_subscription_configuration_options(self):
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

        subscription = self.metadata.create_or_update(data=create_request)

        # Verify all configuration options
        self.assertEqual(subscription.alertType, AlertType.Observability)
        self.assertEqual(subscription.batchSize, 25)
        self.assertEqual(subscription.retries, 5)
        self.assertEqual(subscription.pollInterval, 60)
        self.assertEqual(subscription.destinations[0].timeout, 15)
        self.assertEqual(subscription.destinations[0].readTimeout, 20)

        # Clean up
        self.metadata.delete(
            entity=EventSubscription, entity_id=subscription.id, hard_delete=True
        )
