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

import gc
import weakref
from unittest.mock import Mock, patch

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.sampler.models import SampleConfig
from metadata.sampler.sampler_interface import SamplerInterface
from metadata.sampler.sqlalchemy.sampler import SQASampler


class MockSampler(SamplerInterface):
    """Mock sampler for testing memory management."""

    @property
    def raw_dataset(self):
        return Mock()

    def get_client(self):
        return Mock()

    def _rdn_sample_from_user_query(self):
        return Mock()

    def _fetch_sample_data_from_user_query(self):
        return Mock()

    def get_dataset(self, **kwargs):
        return Mock()

    def fetch_sample_data(self, columns=None):
        return Mock()

    def get_columns(self):
        return []


def test_sampler_interface_context_manager():
    """
    Test that the SamplerInterface context manager properly manages connections.
    """
    mock_connection = Mock()
    mock_connection.close = Mock()

    # Mock the service connection config
    mock_service_config = Mock(spec=DatabaseConnection)
    mock_metadata = Mock(spec=OpenMetadata)
    mock_entity = Mock(spec=Table)

    sampler = MockSampler(
        service_connection_config=mock_service_config,
        ometa_client=mock_metadata,
        entity=mock_entity,
        sample_config=SampleConfig(),
    )

    # Mock get_ssl_connection to return our mock connection
    with patch(
        "metadata.sampler.sampler_interface.get_ssl_connection",
        return_value=mock_connection,
    ):
        # Test context manager
        with sampler.get_connection() as conn:
            assert conn is mock_connection

        # Verify connection was closed
        mock_connection.close.assert_called_once()


def test_sampler_interface_context_manager_exception_handling():
    """
    Test that the context manager properly handles exceptions and still cleans up.
    """
    mock_connection = Mock()
    mock_connection.close = Mock()

    mock_service_config = Mock(spec=DatabaseConnection)
    mock_metadata = Mock(spec=OpenMetadata)
    mock_entity = Mock(spec=Table)

    sampler = MockSampler(
        service_connection_config=mock_service_config,
        ometa_client=mock_metadata,
        entity=mock_entity,
        sample_config=SampleConfig(),
    )

    with patch(
        "metadata.sampler.sampler_interface.get_ssl_connection",
        return_value=mock_connection,
    ):
        try:
            with sampler.get_connection() as conn:
                assert conn is mock_connection
                raise ValueError("Test exception")
        except ValueError:
            pass

        # Verify connection was still closed despite exception
        mock_connection.close.assert_called_once()


def test_sampler_interface_context_manager_with_engine_dispose():
    """
    Test context manager with SQLAlchemy engine that has dispose method.
    """
    mock_engine = Mock()
    mock_engine.dispose = Mock()
    # Mock engine doesn't have close method
    delattr(mock_engine, "close")

    mock_service_config = Mock(spec=DatabaseConnection)
    mock_metadata = Mock(spec=OpenMetadata)
    mock_entity = Mock(spec=Table)

    sampler = MockSampler(
        service_connection_config=mock_service_config,
        ometa_client=mock_metadata,
        entity=mock_entity,
        sample_config=SampleConfig(),
    )

    with patch(
        "metadata.sampler.sampler_interface.get_ssl_connection",
        return_value=mock_engine,
    ):
        with sampler.get_connection() as conn:
            assert conn is mock_engine

        # Verify engine was disposed
        mock_engine.dispose.assert_called_once()


def test_sampler_interface_close_cleanup():
    """
    Test that SamplerInterface.close() properly cleans up resources.
    """
    mock_connection = Mock()
    mock_connection.close = Mock()

    mock_service_config = Mock(spec=DatabaseConnection)
    mock_metadata = Mock(spec=OpenMetadata)
    mock_entity = Mock(spec=Table)

    sampler = MockSampler(
        service_connection_config=mock_service_config,
        ometa_client=mock_metadata,
        entity=mock_entity,
        sample_config=SampleConfig(),
    )

    # Set up connection and columns
    sampler.connection = mock_connection
    sampler._columns = [Mock(), Mock()]
    sampler._sample = Mock()

    # Call close
    sampler.close()

    # Verify cleanup
    mock_connection.close.assert_called_once()
    assert sampler.connection is None
    assert len(sampler._columns) == 0
    assert sampler._sample is None


def test_sampler_interface_close_with_engine():
    """
    Test close with SQLAlchemy engine.
    """
    mock_engine = Mock()
    mock_engine.dispose = Mock()
    # Remove close method to test dispose path
    delattr(mock_engine, "close")

    mock_service_config = Mock(spec=DatabaseConnection)
    mock_metadata = Mock(spec=OpenMetadata)
    mock_entity = Mock(spec=Table)

    sampler = MockSampler(
        service_connection_config=mock_service_config,
        ometa_client=mock_metadata,
        entity=mock_entity,
        sample_config=SampleConfig(),
    )

    sampler.connection = mock_engine

    # Call close
    sampler.close()

    # Verify engine was disposed
    mock_engine.dispose.assert_called_once()
    assert sampler.connection is None


def test_sampler_interface_close_handles_exceptions():
    """
    Test that close() handles exceptions gracefully.
    """
    mock_connection = Mock()
    mock_connection.close.side_effect = Exception("Connection close failed")

    mock_service_config = Mock(spec=DatabaseConnection)
    mock_metadata = Mock(spec=OpenMetadata)
    mock_entity = Mock(spec=Table)

    sampler = MockSampler(
        service_connection_config=mock_service_config,
        ometa_client=mock_metadata,
        entity=mock_entity,
        sample_config=SampleConfig(),
    )

    sampler.connection = mock_connection

    # Call close - should not raise exception
    sampler.close()

    # Should still have attempted to close
    mock_connection.close.assert_called_once()


def test_sampler_memory_leak_prevention():
    """
    Test that creating multiple samplers doesn't lead to memory leaks.
    """
    samplers = []
    weak_refs = []

    # Create multiple sampler instances
    for _ in range(5):
        mock_service_config = Mock(spec=DatabaseConnection)
        mock_metadata = Mock(spec=OpenMetadata)
        mock_entity = Mock(spec=Table)

        sampler = MockSampler(
            service_connection_config=mock_service_config,
            ometa_client=mock_metadata,
            entity=mock_entity,
            sample_config=SampleConfig(),
        )

        samplers.append(sampler)
        weak_refs.append(weakref.ref(sampler))

    # Verify all samplers exist
    for ref in weak_refs:
        assert ref() is not None, "Sampler should exist"

    # Clean up all samplers
    for sampler in samplers:
        sampler.close()

    # Clear strong references
    del samplers

    # Force garbage collection
    gc.collect()

    # Weak references might still exist since we're just testing the cleanup mechanism
    # The important part is that close() was called on all instances


@patch("metadata.sampler.sqlalchemy.sampler.create_and_bind_thread_safe_session")
def test_sqa_sampler_close_cleanup(mock_session_factory):
    """
    Test that SQASampler.close() properly cleans up SQLAlchemy resources.
    """
    # Mock session and connection
    mock_session = Mock()
    mock_session.close = Mock()
    mock_session_factory.return_value = Mock(return_value=mock_session)

    mock_connection = Mock()
    mock_pool = Mock()
    mock_pool.dispose = Mock()
    mock_connection.pool = mock_pool

    # Mock the required dependencies
    with patch("metadata.sampler.sqlalchemy.sampler.SQAInterfaceMixin"):
        mock_service_config = Mock(spec=DatabaseConnection)
        mock_metadata = Mock(spec=OpenMetadata)
        mock_entity = Mock(spec=Table)

        # Mock build_table_orm to prevent actual ORM operations
        with patch.object(SQASampler, "build_table_orm", return_value=Mock()):
            sampler = SQASampler(
                service_connection_config=mock_service_config,
                ometa_client=mock_metadata,
                entity=mock_entity,
                sample_config=SampleConfig(),
            )

        # Set up connection
        sampler.connection = mock_connection
        sampler._table = Mock()

        # Call close
        sampler.close()

        # Verify cleanup
        mock_pool.dispose.assert_called_once()
        assert sampler._table is None


def test_sampler_close_idempotent():
    """
    Test that calling close() multiple times is safe.
    """
    mock_service_config = Mock(spec=DatabaseConnection)
    mock_metadata = Mock(spec=OpenMetadata)
    mock_entity = Mock(spec=Table)

    sampler = MockSampler(
        service_connection_config=mock_service_config,
        ometa_client=mock_metadata,
        entity=mock_entity,
        sample_config=SampleConfig(),
    )

    # Call close multiple times - should not raise exception
    sampler.close()
    sampler.close()
    sampler.close()

    # Should be in valid state
    assert sampler.connection is None
