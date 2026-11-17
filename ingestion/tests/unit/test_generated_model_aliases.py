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
            "entity.services.connections.dashboard.sapS4Hana.basicAuth.SapS4HanaBasicAuth",
        ),
        (
            "entity.services.connections.dashboard.sapS4HanaConnection",
            "SapS4HanaOAuthType",
            "entity.services.connections.dashboard.sapS4Hana.oAuth.SapS4HanaOAuthCredentials",
        ),
        (
            "entity.services.connections.messaging.natsConnection",
            "BasicAuth",
            "entity.services.connections.messaging.nats.basicAuth.NatsBasicAuth",
        ),
        (
            "entity.services.connections.messaging.natsConnection",
            "NkeyAuth",
            "entity.services.connections.messaging.nats.nkeyAuth.NatsNkeyAuth",
        ),
        (
            "entity.services.connections.messaging.natsConnection",
            "TokenAuth",
            "entity.services.connections.messaging.nats.tokenAuth.NatsTokenAuth",
        ),
        (
            "entity.services.connections.dashboard.qlikSenseConnection",
            "QlikCertificatePath",
            "entity.services.connections.dashboard.qlikSense.certificatePath.QlikCertificatePath",
        ),
        (
            "entity.services.connections.dashboard.qlikSenseConnection",
            "QlikCertificateValues",
            "entity.services.connections.dashboard.qlikSense.certificateValues.QlikCertificateValues",
        ),
        (
            "entity.services.connections.dashboard.powerBIConnection",
            "LocalConfig",
            "entity.services.connections.dashboard.powerbi.localConfig.PowerBILocalConfig",
        ),
        (
            "metadataIngestion.storageServiceMetadataPipeline",
            "NoMetadataConfigurationSource",
            "metadataIngestion.storage.storageMetadataNoConfig.StorageMetadataNoConfig",
        ),
    ],
)
def test_legacy_name_still_imports(module, name, target):
    legacy = getattr(importlib.import_module(f"{GENERATED}.{module}"), name)
    target_module, target_name = target.rsplit(".", 1)
    canonical = getattr(importlib.import_module(f"{GENERATED}.{target_module}"), target_name)
    assert legacy is canonical
