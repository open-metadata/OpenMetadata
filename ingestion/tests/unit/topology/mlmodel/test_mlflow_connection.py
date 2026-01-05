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
"""Test MLFlow connection with token authentication"""
import os
import sys
from unittest.mock import MagicMock, patch

# Mock the mlflow module before importing anything else
sys.modules['mlflow'] = MagicMock()
sys.modules['mlflow.tracking'] = MagicMock()


def test_mlflow_connection_without_token():
    """Test MLFlow connection without token"""
    connection_config = MlflowConnection(
        trackingUri="http://localhost:5000",
        registryUri="mysql+pymysql://mlflow:password@localhost:3307/experiments",
    )
    
    # Clear any existing token
    os.environ.pop("MLFLOW_TRACKING_TOKEN", None)
    
    with patch("metadata.ingestion.source.mlmodel.mlflow.connection.MlflowClient") as mock_client:
        get_connection(connection_config)
        
        # Verify MlflowClient was called with correct parameters
        mock_client.assert_called_once_with(
            tracking_uri="http://localhost:5000",
            registry_uri="mysql+pymysql://mlflow:password@localhost:3307/experiments",
        )
        
        # Verify token was not set
        assert "MLFLOW_TRACKING_TOKEN" not in os.environ


def test_mlflow_connection_with_token():
    """Test MLFlow connection with token"""
    test_token = "test_mlflow_token_12345"
    connection_config = MlflowConnection(
        trackingUri="http://localhost:5000",
        registryUri="mysql+pymysql://mlflow:password@localhost:3307/experiments",
        token=CustomSecretStr(test_token),
    )
    
    # Clear any existing token
    os.environ.pop("MLFLOW_TRACKING_TOKEN", None)
    
    with patch("metadata.ingestion.source.mlmodel.mlflow.connection.MlflowClient") as mock_client:
        get_connection(connection_config)
        
        # Verify MlflowClient was called with correct parameters
        mock_client.assert_called_once_with(
            tracking_uri="http://localhost:5000",
            registry_uri="mysql+pymysql://mlflow:password@localhost:3307/experiments",
        )
        
        # Verify token was set in environment
        assert os.environ.get("MLFLOW_TRACKING_TOKEN") == test_token
    
    # Clean up
    os.environ.pop("MLFLOW_TRACKING_TOKEN", None)


def test_mlflow_connection_token_override():
    """Test that new token overrides existing environment variable"""
    old_token = "old_token"
    new_token = "new_token_12345"
    
    # Set an old token
    os.environ["MLFLOW_TRACKING_TOKEN"] = old_token
    
    connection_config = MlflowConnection(
        trackingUri="http://localhost:5000",
        registryUri="mysql+pymysql://mlflow:password@localhost:3307/experiments",
        token=CustomSecretStr(new_token),
    )
    
    with patch("metadata.ingestion.source.mlmodel.mlflow.connection.MlflowClient") as mock_client:
        get_connection(connection_config)
        
        # Verify new token replaced the old one
        assert os.environ.get("MLFLOW_TRACKING_TOKEN") == new_token
        assert os.environ.get("MLFLOW_TRACKING_TOKEN") != old_token
    
    # Clean up
    os.environ.pop("MLFLOW_TRACKING_TOKEN", None)
