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
OpenMetadata MlModel mixin unit test — validates sklearn model → CreateMlModelRequest conversion
"""
from unittest.mock import patch

import pandas as pd
import sklearn.datasets as datasets
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.mlmodelService import MlModelService
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.ingestion.ometa.ometa_api import OpenMetadata

server_config = OpenMetadataConnection(
    hostPort="http://localhost:8585/api",
    authProvider="openmetadata",
    securityConfig=OpenMetadataJWTClientConfig(
        jwtToken="eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
    ),
)
metadata = OpenMetadata(server_config)


class TestMlModelSklearn:
    """
    Unit test for get_mlmodel_sklearn — validates that sklearn model metadata
    is correctly extracted into a CreateMlModelRequest without calling the server.
    """

    def test_get_sklearn(self):
        iris = datasets.load_iris()
        df = pd.DataFrame(iris.data, columns=iris.feature_names)
        y = iris.target

        x_train, _, y_train, _ = train_test_split(
            df, y, test_size=0.25, random_state=70
        )

        dtree = DecisionTreeClassifier()
        dtree.fit(x_train, y_train)

        mock_service = MlModelService(
            id="85811038-099a-11ed-861d-0242ac120002",
            name="scikit-learn",
            fullyQualifiedName=FullyQualifiedEntityName("scikit-learn"),
            serviceType="Sklearn",
            connection={"config": {"type": "Sklearn"}},
        )

        with patch.object(
            OpenMetadata, "get_service_or_create", return_value=mock_service
        ):
            request = metadata.get_mlmodel_sklearn(
                name="test-sklearn",
                model=dtree,
                description="Creating a test sklearn model",
            )

        assert request.name.root == "test-sklearn"
        assert request.algorithm == "DecisionTreeClassifier"
        assert request.description.root == "Creating a test sklearn model"
        assert request.service.root == "scikit-learn"

        feature_names = {feature.name.root for feature in request.mlFeatures}
        assert feature_names == {
            "sepal_length__cm_",
            "sepal_width__cm_",
            "petal_length__cm_",
            "petal_width__cm_",
        }

        param_names = {param.name for param in request.mlHyperParameters}
        assert "criterion" in param_names
        assert "max_depth" in param_names
        assert "random_state" in param_names

        criterion_param = next(
            param for param in request.mlHyperParameters if param.name == "criterion"
        )
        assert criterion_param is not None
        assert criterion_param.value is not None
