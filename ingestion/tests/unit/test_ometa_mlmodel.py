#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
OpenMetadata MlModel mixin test
"""
from unittest import TestCase

import pandas as pd
import sklearn.datasets as datasets
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier

from metadata.generated.schema.api.data.createMlModel import CreateMlModelEntityRequest
from metadata.generated.schema.entity.data.mlmodel import MlFeature, MlModel
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig


class OMetaModelMixinTest(TestCase):
    """
    Test the MlModel integrations from MlModel Mixin
    """

    server_config = MetadataServerConfig(api_endpoint="http://localhost:8585/api")
    metadata = OpenMetadata(server_config)

    iris = datasets.load_iris()

    def test_get_sklearn(self):
        """
        Check that we can ingest an SKlearn model
        """
        df = pd.DataFrame(self.iris.data, columns=self.iris.feature_names)
        y = self.iris.target

        x_train, x_test, y_train, y_test = train_test_split(
            df, y, test_size=0.25, random_state=70
        )

        dtree = DecisionTreeClassifier()
        dtree.fit(x_train, y_train)

        entity_create: CreateMlModelEntityRequest = self.metadata.get_mlmodel_sklearn(
            name="test-sklearn",
            model=dtree,
            description="Creating a test sklearn model",
        )

        entity: MlModel = self.metadata.create_or_update(data=entity_create)

        self.assertEqual(entity.name, entity_create.name)
        self.assertEqual(entity.algorithm, "DecisionTreeClassifier")
        self.assertEqual(
            {feature.name.__root__ for feature in entity.mlFeatures},
            {
                "sepal_length__cm_",
                "sepal_width__cm_",
                "petal_length__cm_",
                "petal_width__cm_",
            },
        )

        hyper_param = next(
            iter(
                param for param in entity.mlHyperParameters if param.name == "criterion"
            ),
            None,
        )
        self.assertIsNotNone(hyper_param)
