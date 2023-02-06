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
OpenMetadata high-level API Model test
"""
import uuid
from unittest import TestCase

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createMlModel import CreateMlModelRequest
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.api.services.createMlModelService import (
    CreateMlModelServiceRequest,
)
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.data.mlmodel import (
    FeatureSource,
    FeatureSourceDataType,
    FeatureType,
    MlFeature,
    MlHyperParameter,
    MlModel,
)
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.connections.mlmodel.mlflowConnection import (
    MlflowConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.entity.services.mlmodelService import (
    MlModelConnection,
    MlModelService,
    MlModelServiceType,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.ometa_api import OpenMetadata


class OMetaModelTest(TestCase):
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

    server_config = OpenMetadataConnection(
        hostPort="http://localhost:8585/api",
        authProvider="openmetadata",
        securityConfig=OpenMetadataJWTClientConfig(
            jwtToken="eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
        ),
    )
    metadata = OpenMetadata(server_config)

    assert metadata.health_check()

    user = metadata.create_or_update(
        data=CreateUserRequest(name="random-user", email="random@user.com"),
    )
    owner = EntityReference(id=user.id, type="user")

    service = CreateMlModelServiceRequest(
        name="test-model-service",
        serviceType=MlModelServiceType.Mlflow,
        connection=MlModelConnection(
            config=MlflowConnection(
                trackingUri="http://localhost:1234",
                registryUri="http://localhost:4321",
            )
        ),
    )

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare ingredients
        """

        cls.service_entity = cls.metadata.create_or_update(data=cls.service)
        cls.service_reference = EntityReference(
            id=cls.service_entity.id, name="test-mlflow", type="mlmodelService"
        )

        cls.create = CreateMlModelRequest(
            name="test-model", algorithm="algo", service=cls.service_reference
        )

        cls.entity = MlModel(
            id=uuid.uuid4(),
            name="test-model",
            algorithm="algo",
            fullyQualifiedName="test-model-service.test-model",
            service=cls.service_reference,
        )

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up
        """

        service_id = str(
            cls.metadata.get_by_name(
                entity=MlModelService, fqn="test-model-service"
            ).id.__root__
        )

        cls.metadata.delete(
            entity=MlModelService,
            entity_id=service_id,
            recursive=True,
            hard_delete=True,
        )

    def test_create(self):
        """
        We can create a Model and we receive it back as Entity
        """

        res = self.metadata.create_or_update(data=self.create)

        self.assertEqual(res.name, self.entity.name)
        self.assertEqual(res.algorithm, self.entity.algorithm)
        self.assertEqual(res.owner, None)

    def test_update(self):
        """
        Updating it properly changes its properties
        """

        res_create = self.metadata.create_or_update(data=self.create)

        updated = self.create.dict(exclude_unset=True)
        updated["owner"] = self.owner
        updated_entity = CreateMlModelRequest(**updated)

        res = self.metadata.create_or_update(data=updated_entity)

        # Same ID, updated algorithm
        self.assertEqual(res.algorithm, updated_entity.algorithm)
        self.assertEqual(res_create.id, res.id)
        self.assertEqual(res.owner.id, self.user.id)

        # Getting without owner field does not return it by default
        res_none = self.metadata.get_by_name(
            entity=MlModel, fqn=self.entity.fullyQualifiedName
        )
        self.assertIsNone(res_none.owner)

        # We can request specific fields to be added
        res_owner = self.metadata.get_by_name(
            entity=MlModel,
            fqn=self.entity.fullyQualifiedName,
            fields=["owner", "followers"],
        )
        self.assertEqual(res_owner.owner.id, self.user.id)

    def test_get_name(self):
        """
        We can fetch a model by name and get it back as Entity
        """

        self.metadata.create_or_update(data=self.create)

        res = self.metadata.get_by_name(
            entity=MlModel, fqn=self.entity.fullyQualifiedName
        )
        self.assertEqual(res.name, self.entity.name)

    def test_get_id(self):
        """
        We can fetch a model by ID and get it back as Entity
        """

        self.metadata.create_or_update(data=self.create)

        # First pick up by name
        res_name = self.metadata.get_by_name(
            entity=MlModel, fqn=self.entity.fullyQualifiedName
        )
        # Then fetch by ID
        res = self.metadata.get_by_id(entity=MlModel, entity_id=res_name.id)

        self.assertEqual(res_name.id, res.id)

    def test_list(self):
        """
        We can list all our models
        """

        self.metadata.create_or_update(data=self.create)

        res = self.metadata.list_entities(entity=MlModel)

        # Fetch our test model. We have already inserted it, so we should find it
        data = next(
            iter(ent for ent in res.entities if ent.name == self.entity.name), None
        )
        assert data

    def test_delete(self):
        """
        We can delete a model by ID
        """

        self.metadata.create_or_update(data=self.create)

        # Find by name
        res_name = self.metadata.get_by_name(
            entity=MlModel, fqn=self.entity.fullyQualifiedName
        )
        # Then fetch by ID
        res_id = self.metadata.get_by_id(
            entity=MlModel, entity_id=str(res_name.id.__root__)
        )

        # Delete
        self.metadata.delete(entity=MlModel, entity_id=str(res_id.id.__root__))

        # Then we should not find it
        res = self.metadata.list_entities(entity=MlModel)

        assert not next(
            iter(
                ent
                for ent in res.entities
                if ent.fullyQualifiedName == self.entity.fullyQualifiedName
            ),
            None,
        )

    def test_mlmodel_properties(self):
        """
        Check that we can create models with MLFeatures and MLHyperParams

        We can add lineage information
        """

        service = CreateDatabaseServiceRequest(
            name="test-service-table-ml",
            serviceType=DatabaseServiceType.Mysql,
            connection=DatabaseConnection(
                config=MysqlConnection(
                    username="username",
                    password="password",
                    hostPort="http://localhost:1234",
                )
            ),
        )
        service_entity = self.metadata.create_or_update(data=service)

        create_db = CreateDatabaseRequest(
            name="test-db-ml",
            service=service_entity.fullyQualifiedName,
        )
        create_db_entity = self.metadata.create_or_update(data=create_db)

        create_schema = CreateDatabaseSchemaRequest(
            name="test-schema-ml",
            database=create_db_entity.fullyQualifiedName,
        )
        create_schema_entity = self.metadata.create_or_update(data=create_schema)

        create_table1 = CreateTableRequest(
            name="test-ml",
            databaseSchema=create_schema_entity.fullyQualifiedName,
            columns=[Column(name="education", dataType=DataType.STRING)],
        )
        table1_entity = self.metadata.create_or_update(data=create_table1)

        create_table2 = CreateTableRequest(
            name="another_test-ml",
            databaseSchema=schema_reference,
            columns=[Column(name="age", dataType=DataType.INT)],
        )
        table2_entity = self.metadata.create_or_update(data=create_table2)

        model = CreateMlModelRequest(
            name="test-model-lineage",
            algorithm="algo",
            mlFeatures=[
                MlFeature(
                    name="age",
                    dataType=FeatureType.numerical,
                    featureSources=[
                        FeatureSource(
                            name="age",
                            dataType=FeatureSourceDataType.integer,
                            dataSource=self.metadata.get_entity_reference(
                                entity=Table, fqn=table2_entity.fullyQualifiedName
                            ),
                        )
                    ],
                ),
                MlFeature(
                    name="persona",
                    dataType=FeatureType.categorical,
                    featureSources=[
                        FeatureSource(
                            name="age",
                            dataType=FeatureSourceDataType.integer,
                            dataSource=self.metadata.get_entity_reference(
                                entity=Table, fqn=table2_entity.fullyQualifiedName
                            ),
                        ),
                        FeatureSource(
                            name="education",
                            dataType=FeatureSourceDataType.string,
                            dataSource=self.metadata.get_entity_reference(
                                entity=Table, fqn=table1_entity.fullyQualifiedName
                            ),
                        ),
                        FeatureSource(
                            name="city", dataType=FeatureSourceDataType.string
                        ),
                    ],
                    featureAlgorithm="PCA",
                ),
            ],
            mlHyperParameters=[
                MlHyperParameter(name="regularisation", value="0.5"),
                MlHyperParameter(name="random", value="hello"),
            ],
            target="myTarget",
            service=self.service_reference,
        )

        res: MlModel = self.metadata.create_or_update(data=model)

        self.assertIsNotNone(res.mlFeatures)
        self.assertIsNotNone(res.mlHyperParameters)

        # Lineage will be created just by ingesting the model.
        # Alternatively, we could manually send lineage via `add_mlmodel_lineage`
        # E.g., lineage = self.metadata.add_mlmodel_lineage(model=res)
        lineage = self.metadata.get_lineage_by_id(
            entity=MlModel, entity_id=str(res.id.__root__)
        )

        nodes = {node["id"] for node in lineage["nodes"]}
        assert nodes == {str(table1_entity.id.__root__), str(table2_entity.id.__root__)}

        self.metadata.delete(
            entity=DatabaseService,
            entity_id=service_entity.id,
            recursive=True,
            hard_delete=True,
        )

    def test_list_versions(self):
        """
        test list MLmodel entity versions
        """
        self.metadata.create_or_update(data=self.create)

        # Find by name
        res_name = self.metadata.get_by_name(
            entity=MlModel, fqn=self.entity.fullyQualifiedName
        )

        res = self.metadata.get_list_entity_versions(
            entity=MlModel, entity_id=res_name.id.__root__
        )
        assert res

    def test_get_entity_version(self):
        """
        test get MLModel entity version
        """
        self.metadata.create_or_update(data=self.create)

        # Find by name
        res_name = self.metadata.get_by_name(
            entity=MlModel, fqn=self.entity.fullyQualifiedName
        )
        res = self.metadata.get_entity_version(
            entity=MlModel, entity_id=res_name.id.__root__, version=0.1
        )

        # check we get the correct version requested and the correct entity ID
        assert res.version.__root__ == 0.1
        assert res.id == res_name.id

    def test_get_entity_ref(self):
        """
        test get EntityReference
        """
        res = self.metadata.create_or_update(data=self.create)
        entity_ref = self.metadata.get_entity_reference(
            entity=MlModel, fqn=res.fullyQualifiedName
        )

        assert res.id == entity_ref.id
