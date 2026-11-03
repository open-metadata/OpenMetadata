#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""Generated models keep the names connectors imported before their branches moved to files."""

import importlib

import pytest

GENERATED = "metadata.generated.schema"


@pytest.mark.parametrize(
    ("module", "name", "target"),
    [
        (
            "entity.services.connections.dashboard.sapS4HanaConnection",
            "SapS4HanaBasicAuthType",
            "SapS4HanaBasicAuth",
        ),
        (
            "entity.services.connections.dashboard.sapS4HanaConnection",
            "SapS4HanaOAuthType",
            "SapS4HanaOAuthCredentials",
        ),
        (
            "entity.services.connections.messaging.natsConnection",
            "BasicAuth",
            "NatsBasicAuth",
        ),
        (
            "entity.services.connections.messaging.natsConnection",
            "NkeyAuth",
            "NatsNkeyAuth",
        ),
        (
            "entity.services.connections.messaging.natsConnection",
            "TokenAuth",
            "NatsTokenAuth",
        ),
        (
            "entity.services.connections.dashboard.qlikSenseConnection",
            "QlikCertificatePath",
            "QlikCertificatePath",
        ),
        (
            "entity.services.connections.dashboard.qlikSenseConnection",
            "QlikCertificateValues",
            "QlikCertificateValues",
        ),
        (
            "entity.services.connections.dashboard.powerBIConnection",
            "LocalConfig",
            "PowerBILocalConfig",
        ),
        (
            "metadataIngestion.storageServiceMetadataPipeline",
            "NoMetadataConfigurationSource",
            "StorageMetadataNoConfig",
        ),
    ],
)
def test_legacy_name_still_imports(module, name, target):
    legacy = getattr(importlib.import_module(f"{GENERATED}.{module}"), name)

    assert legacy.__name__ == target
