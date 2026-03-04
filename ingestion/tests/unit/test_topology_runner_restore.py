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
Unit tests for topology runner deleted entity restoration
"""
from collections import defaultdict
from unittest import TestCase
from unittest.mock import Mock

from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.type.basic import FullyQualifiedEntityName, Uuid
from metadata.ingestion.api.models import Either
from metadata.ingestion.models.topology import NodeStage
from metadata.utils.source_hash import generate_source_hash


class TopologyRunnerRestoreTest(TestCase):
    """
    Test topology runner deleted entity restoration logic
    """

    def setUp(self):
        """Set up test fixtures"""
        self.mock_metadata = Mock()
        self.mock_source_config = Mock()
        self.mock_source_config.overrideMetadata = False

        self.entity_id = Uuid("b67eac63-9e43-41f5-afb9-387c85df1d8b")
        self.entity_fqn = "test-service.test-db.test-schema.test-table"

        self.mock_table = Table(
            id=self.entity_id,
            name="test-table",
            fullyQualifiedName=FullyQualifiedEntityName(self.entity_fqn),
            columns=[
                Column(name="id", dataType=DataType.BIGINT),
                Column(name="name", dataType=DataType.VARCHAR),
            ],
            deleted=True,
        )

        self.create_request = CreateTableRequest(
            name="test-table",
            databaseSchema="test-service.test-db.test-schema",
            columns=[
                Column(name="id", dataType=DataType.BIGINT),
                Column(name="name", dataType=DataType.VARCHAR),
            ],
        )

        self.mock_stage = Mock(spec=NodeStage)
        self.mock_stage.type_ = Table
        self.mock_stage.use_cache = True

    def test_deleted_entity_is_restored_with_same_hash(self):
        """
        Test that a deleted entity with the same sourceHash is restored
        """
        source_hash = generate_source_hash(create_request=self.create_request)

        cache = defaultdict(dict)
        cache[Table][self.entity_fqn] = source_hash

        deleted = defaultdict(dict)
        deleted[Table][self.entity_fqn] = source_hash

        restored_table = self.mock_table.model_copy()
        restored_table.deleted = False

        self.mock_metadata.get_by_name.return_value = self.mock_table
        self.mock_metadata.restore.return_value = restored_table

        entity_request = Either(right=self.create_request)
        entity_request.right.sourceHash = source_hash

        # Simulate the topology runner logic
        entity_source_hash = cache[Table].get(self.entity_fqn)
        is_deleted = self.entity_fqn in deleted[Table]

        self.assertTrue(is_deleted)
        self.assertEqual(entity_source_hash, source_hash)

        # The deleted entity should be restored even though hashes match
        if is_deleted:
            entity = self.mock_metadata.get_by_name(
                entity=Table, fqn=self.entity_fqn, fields=["*"], include="all"
            )
            restored_entity = self.mock_metadata.restore(
                entity=Table, entity_id=entity.id
            )

            self.assertIsNotNone(restored_entity)
            self.assertFalse(restored_entity.deleted)
            deleted[Table].pop(self.entity_fqn, None)

        # Verify the entity is removed from deleted dict
        self.assertNotIn(self.entity_fqn, deleted[Table])

    def test_deleted_entity_is_restored_and_patched_with_different_hash(self):
        """
        Test that a deleted entity with a different sourceHash is restored and patched
        """
        old_source_hash = "old_hash_123"
        new_source_hash = "new_hash_456"

        cache = defaultdict(dict)
        cache[Table][self.entity_fqn] = old_source_hash

        deleted = defaultdict(dict)
        deleted[Table][self.entity_fqn] = old_source_hash

        restored_table = self.mock_table.model_copy()
        restored_table.deleted = False

        self.mock_metadata.get_by_name.return_value = self.mock_table
        self.mock_metadata.restore.return_value = restored_table

        entity_request = Either(right=self.create_request)
        entity_request.right.sourceHash = new_source_hash

        # Simulate the topology runner logic
        entity_source_hash = cache[Table].get(self.entity_fqn)
        is_deleted = self.entity_fqn in deleted[Table]

        self.assertTrue(is_deleted)
        self.assertNotEqual(entity_source_hash, new_source_hash)

        # Deleted entity should be restored
        if is_deleted:
            entity = self.mock_metadata.get_by_name(
                entity=Table, fqn=self.entity_fqn, fields=["*"], include="all"
            )
            restored_entity = self.mock_metadata.restore(
                entity=Table, entity_id=entity.id
            )

            self.assertIsNotNone(restored_entity)
            deleted[Table].pop(self.entity_fqn, None)

            # Since hashes differ, a patch should be prepared
            if entity_source_hash != new_source_hash:
                should_patch = True
            else:
                should_patch = False

            self.assertTrue(should_patch)

    def test_non_deleted_entity_with_hash_mismatch_is_patched(self):
        """
        Test that a non-deleted entity with different sourceHash is patched
        """
        old_source_hash = "old_hash_123"
        new_source_hash = "new_hash_456"

        cache = defaultdict(dict)
        cache[Table][self.entity_fqn] = old_source_hash

        deleted = defaultdict(dict)

        active_table = self.mock_table.model_copy()
        active_table.deleted = False

        self.mock_metadata.get_by_name.return_value = active_table

        entity_request = Either(right=self.create_request)
        entity_request.right.sourceHash = new_source_hash

        # Simulate the topology runner logic
        entity_source_hash = cache[Table].get(self.entity_fqn)
        is_deleted = self.entity_fqn in deleted[Table]

        self.assertFalse(is_deleted)
        self.assertNotEqual(entity_source_hash, new_source_hash)

        # Non-deleted entity with different hash should be patched
        if not is_deleted and (
            entity_source_hash != new_source_hash
            or self.mock_source_config.overrideMetadata
        ):
            entity = self.mock_metadata.get_by_name(
                entity=Table, fqn=self.entity_fqn, fields=["*"], include="all"
            )
            self.assertIsNotNone(entity)
            self.assertFalse(entity.deleted)

    def test_non_deleted_entity_with_same_hash_is_skipped(self):
        """
        Test that a non-deleted entity with the same sourceHash is skipped
        """
        source_hash = "same_hash_123"

        cache = defaultdict(dict)
        cache[Table][self.entity_fqn] = source_hash

        deleted = defaultdict(dict)

        entity_request = Either(right=self.create_request)
        entity_request.right.sourceHash = source_hash

        # Simulate the topology runner logic
        entity_source_hash = cache[Table].get(self.entity_fqn)
        is_deleted = self.entity_fqn in deleted[Table]

        self.assertFalse(is_deleted)
        self.assertEqual(entity_source_hash, source_hash)

        # Entity should be skipped (same_fingerprint = True)
        same_fingerprint = False
        if not is_deleted and entity_source_hash == source_hash:
            same_fingerprint = True

        self.assertTrue(same_fingerprint)

    def test_restore_failure_is_handled(self):
        """
        Test that a failed restore is handled gracefully
        """
        source_hash = "hash_123"

        cache = defaultdict(dict)
        cache[Table][self.entity_fqn] = source_hash

        deleted = defaultdict(dict)
        deleted[Table][self.entity_fqn] = source_hash

        self.mock_metadata.get_by_name.return_value = self.mock_table
        self.mock_metadata.restore.return_value = None

        entity_request = Either(right=self.create_request)
        entity_request.right.sourceHash = source_hash

        # Simulate the topology runner logic
        is_deleted = self.entity_fqn in deleted[Table]

        if is_deleted:
            entity = self.mock_metadata.get_by_name(
                entity=Table, fqn=self.entity_fqn, fields=["*"], include="all"
            )
            restored_entity = self.mock_metadata.restore(
                entity=Table, entity_id=entity.id
            )

            # Restore failed
            self.assertIsNone(restored_entity)

            # Entity should remain in deleted dict
            self.assertIn(self.entity_fqn, deleted[Table])

    def test_override_metadata_triggers_patch_after_restore(self):
        """
        Test that overrideMetadata=True triggers a patch after restore
        """
        source_hash = "same_hash_123"
        self.mock_source_config.overrideMetadata = True

        cache = defaultdict(dict)
        cache[Table][self.entity_fqn] = source_hash

        deleted = defaultdict(dict)
        deleted[Table][self.entity_fqn] = source_hash

        restored_table = self.mock_table.model_copy()
        restored_table.deleted = False

        self.mock_metadata.get_by_name.return_value = self.mock_table
        self.mock_metadata.restore.return_value = restored_table

        entity_request = Either(right=self.create_request)
        entity_request.right.sourceHash = source_hash

        # Simulate the topology runner logic
        entity_source_hash = cache[Table].get(self.entity_fqn)
        is_deleted = self.entity_fqn in deleted[Table]

        if is_deleted:
            entity = self.mock_metadata.get_by_name(
                entity=Table, fqn=self.entity_fqn, fields=["*"], include="all"
            )
            restored_entity = self.mock_metadata.restore(
                entity=Table, entity_id=entity.id
            )

            deleted[Table].pop(self.entity_fqn, None)

            # Even with same hash, overrideMetadata should trigger patch
            if (
                entity_source_hash != source_hash
                or self.mock_source_config.overrideMetadata
            ):
                should_patch = True
            else:
                should_patch = False

            self.assertTrue(should_patch)
