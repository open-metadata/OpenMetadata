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
Test Sagemaker.
"""

from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.api.data.createMlModel import CreateMlModelRequest
from metadata.generated.schema.entity.data.mlmodel import MlStore
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.parser import parse_workflow_config_gracefully
from metadata.ingestion.source.mlmodel.sagemaker.metadata import SagemakerSource

ML_MODEL_SERVICE_MOCK = "unittest_sagemaker"

MODELS_MOCK = [
    {
        "ModelName": "model_1",
        "ModelArn": "arn::model_1",
        "CreationTime": "2020-01-01 00:00:00",
    },
    {
        "ModelName": "model_2",
        "ModelArn": "arn::model_2",
        "CreationTime": "2020-01-01 00:00:00",
    },
    {
        "ModelName": "model_3",
        "ModelArn": "arn::model_3",
        "CreationTime": "2020-01-01 00:00:00",
    },
]

MODEL_DESCRIPTIONS_MOCK = {
    "model_1": {
        "PrimaryContainer": {
            "Image": "image_1",
            "ModelDataUrl": "file://storage_1",
        }
    },
    "model_2": {
        "PrimaryContainer": {
            "ModelDataUrl": "file://storage_2",
        }
    },
    "model_3": {},
}

EXPECTED_MODELS = [
    CreateMlModelRequest(
        name="model_1",
        algorithm="mlmodel",
        mlStore=MlStore(storage="file://storage_1", imageRepository="image_1"),
        service=ML_MODEL_SERVICE_MOCK,
    ),
    CreateMlModelRequest(
        name="model_2",
        algorithm="mlmodel",
        mlStore=MlStore(storage="file://storage_2"),
        service=ML_MODEL_SERVICE_MOCK,
    ),
    CreateMlModelRequest(
        name="model_3", algorithm="mlmodel", mlStore=None, service=ML_MODEL_SERVICE_MOCK
    ),
]


class SagemakerClientMock:
    def __init__(self):
        pass

    def list_models(self, *args, **kwargs):
        return {"Models": MODELS_MOCK, "NextToken": None}

    def describe_model(self, modelName: str, *args, **kwargs):
        return MODEL_DESCRIPTIONS_MOCK.get(modelName)


sagemaker_config = {
    "source": {
        "type": "sagemaker",
        "serviceName": ML_MODEL_SERVICE_MOCK,
        "serviceConnection": {
            "config": {
                "type": "SageMaker",
                "awsConfig": {
                    "awsAccessKeyId": "access_key",
                    "awsSecretAccessKey": "secret_access_key",
                    "awsSessionToken": "session_token",
                    "awsRegion": "region",
                },
            }
        },
        "sourceConfig": {
            "config": {
                "type": "MlModelMetadata",
            }
        },
    },
    "sink": {
        "type": "metadata-rest",
        "config": {},
    },
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {
                "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            },
        }
    },
}


class SagemakerTest(TestCase):
    @patch(
        "metadata.ingestion.source.mlmodel.sagemaker.metadata.SagemakerSource.test_connection"
    )
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = parse_workflow_config_gracefully(sagemaker_config)
        self.sagemaker_source = SagemakerSource.create(
            sagemaker_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )

        self.sagemaker_source.sagemaker = SagemakerClientMock()

        self.sagemaker_source.context.get().__dict__[
            "mlmodel_service"
        ] = ML_MODEL_SERVICE_MOCK

    def test_ccreate_ml_model_request_is_correct(self):
        for i, mlmodel in enumerate(self.sagemaker_source.get_mlmodels()):
            assert self.sagemaker_source.yield_mlmodel(mlmodel) == Either(
                right=EXPECTED_MODELS[i]
            )
