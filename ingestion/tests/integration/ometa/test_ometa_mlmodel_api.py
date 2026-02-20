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
OpenMetadata high-level API Model test
"""
import pytest

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createMlModel import CreateMlModelRequest
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.data.mlmodel import (
    FeatureSource,
    FeatureSourceDataType,
    FeatureType,
    MlFeature,
    MlHyperParameter,
    MlModel,
)
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList

from .conftest import _safe_delete


@pytest.fixture
def mlmodel_request(mlmodel_service):
    """Create ML model request using the ML model service from conftest."""
    return CreateMlModelRequest(
        name="test-model",
        algorithm="algo",
        service=mlmodel_service.fullyQualifiedName,
    )


@pytest.fixture
def expected_fqn(mlmodel_service):
    """Expected fully qualified name for test ML model."""
    return f"{mlmodel_service.name.root}.test-model"


class TestOMetaMlModelAPI:
    """
    ML Model API integration tests.
    Tests CRUD operations, versioning, ML features, hyperparameters, and lineage.

    Uses fixtures from conftest:
    - metadata: OpenMetadata client (session scope)
    - mlmodel_service: MlModelService (module scope)
    - create_user: User factory (function scope)
    - create_mlmodel: MlModel factory (function scope)
    """

    def test_create(
        self, metadata, mlmodel_service, mlmodel_request, expected_fqn, create_mlmodel
    ):
        """
        We can create a Model and we receive it back as Entity
        """
        res = create_mlmodel(mlmodel_request)

        assert res.name.root == "test-model"
        assert res.algorithm == "algo"
        assert res.owners is None

        fetched = metadata.get_by_name(entity=MlModel, fqn=expected_fqn)
        assert fetched is not None
        assert fetched.id == res.id

    def test_update(
        self,
        metadata,
        mlmodel_service,
        mlmodel_request,
        expected_fqn,
        create_user,
        create_mlmodel,
    ):
        """
        Updating it properly changes its properties
        """
        user = create_user()
        owners = EntityReferenceList(root=[EntityReference(id=user.id, type="user")])

        res_create = create_mlmodel(mlmodel_request)

        updated = mlmodel_request.model_dump(exclude_unset=True)
        updated["owners"] = owners
        updated_entity = CreateMlModelRequest(**updated)

        res = metadata.create_or_update(data=updated_entity)

        assert res.algorithm == updated_entity.algorithm
        assert res_create.id == res.id
        assert res.owners.root[0].id == user.id

        res_none = metadata.get_by_name(entity=MlModel, fqn=expected_fqn)
        assert res_none.owners is None

        res_owner = metadata.get_by_name(
            entity=MlModel,
            fqn=expected_fqn,
            fields=["owners", "followers"],
        )
        assert res_owner.owners.root[0].id == user.id

    def test_get_name(self, metadata, mlmodel_request, expected_fqn, create_mlmodel):
        """
        We can fetch a model by name and get it back as Entity
        """
        created = create_mlmodel(mlmodel_request)

        res = metadata.get_by_name(entity=MlModel, fqn=expected_fqn)
        assert res.name.root == created.name.root

    def test_get_id(self, metadata, mlmodel_request, expected_fqn, create_mlmodel):
        """
        We can fetch a model by ID and get it back as Entity
        """
        create_mlmodel(mlmodel_request)

        res_name = metadata.get_by_name(entity=MlModel, fqn=expected_fqn)
        res = metadata.get_by_id(entity=MlModel, entity_id=res_name.id)

        assert res_name.id == res.id

    def test_list(self, metadata, mlmodel_request, create_mlmodel):
        """
        We can list all our models
        """
        created = create_mlmodel(mlmodel_request)

        res = metadata.list_entities(entity=MlModel)

        data = next(iter(ent for ent in res.entities if ent.name == created.name), None)
        assert data is not None

    def test_delete(self, metadata, mlmodel_request, expected_fqn, create_mlmodel):
        """
        We can delete a model by ID
        """
        created = create_mlmodel(mlmodel_request)

        metadata.delete(entity=MlModel, entity_id=str(created.id.root))

        deleted = metadata.get_by_name(entity=MlModel, fqn=expected_fqn)
        assert deleted is None

    def test_mlmodel_properties(self, metadata, mlmodel_service):
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
                    authType=BasicAuth(
                        password="password",
                    ),
                    hostPort="http://localhost:1234",
                )
            ),
        )
        service_entity = metadata.create_or_update(data=service)

        create_db = CreateDatabaseRequest(
            name="test-db-ml",
            service=service_entity.fullyQualifiedName,
        )
        create_db_entity = metadata.create_or_update(data=create_db)

        create_schema = CreateDatabaseSchemaRequest(
            name="test-schema-ml",
            database=create_db_entity.fullyQualifiedName,
        )
        create_schema_entity = metadata.create_or_update(data=create_schema)

        create_table1 = CreateTableRequest(
            name="test-ml",
            databaseSchema=create_schema_entity.fullyQualifiedName,
            columns=[Column(name="education", dataType=DataType.STRING)],
        )
        table1_entity = metadata.create_or_update(data=create_table1)

        create_table2 = CreateTableRequest(
            name="another_test-ml",
            databaseSchema=create_schema_entity.fullyQualifiedName,
            columns=[Column(name="age", dataType=DataType.INT)],
        )
        table2_entity = metadata.create_or_update(data=create_table2)

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
                            dataSource=metadata.get_entity_reference(
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
                            dataSource=metadata.get_entity_reference(
                                entity=Table, fqn=table2_entity.fullyQualifiedName
                            ),
                        ),
                        FeatureSource(
                            name="education",
                            dataType=FeatureSourceDataType.string,
                            dataSource=metadata.get_entity_reference(
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
            service=mlmodel_service.fullyQualifiedName,
        )

        res = metadata.create_or_update(data=model)

        try:
            assert res.mlFeatures is not None
            assert res.mlHyperParameters is not None

            lineage = metadata.get_lineage_by_id(
                entity=MlModel, entity_id=str(res.id.root)
            )

            nodes = {node["id"] for node in lineage["nodes"]}
            assert nodes == {str(table1_entity.id.root), str(table2_entity.id.root)}

            for edge in lineage.get("upstreamEdges") or []:
                metadata.delete_lineage_edge(
                    edge=EntitiesEdge(
                        fromEntity=EntityReference(id=edge["fromEntity"], type="table"),
                        toEntity=EntityReference(id=edge["toEntity"], type="mlmodel"),
                    )
                )

            metadata.add_mlmodel_lineage(model=res)

            lineage = metadata.get_lineage_by_id(
                entity=MlModel, entity_id=str(res.id.root)
            )

            nodes = {node["id"] for node in lineage["nodes"]}
            assert nodes == {str(table1_entity.id.root), str(table2_entity.id.root)}
        finally:
            _safe_delete(metadata, entity=MlModel, entity_id=res.id, hard_delete=True)
            _safe_delete(
                metadata,
                entity=DatabaseService,
                entity_id=service_entity.id,
                recursive=True,
                hard_delete=True,
            )

    def test_list_versions(self, metadata, mlmodel_request, create_mlmodel):
        """
        Test listing ML model entity versions
        """
        created = create_mlmodel(mlmodel_request)

        res = metadata.get_list_entity_versions(
            entity=MlModel, entity_id=created.id.root
        )
        assert res is not None
        assert len(res.versions) >= 1

    def test_get_entity_version(self, metadata, mlmodel_request, create_mlmodel):
        """
        Test retrieving a specific ML model entity version
        """
        created = create_mlmodel(mlmodel_request)

        res = metadata.get_entity_version(
            entity=MlModel, entity_id=created.id.root, version=0.1
        )

        assert res.version.root == 0.1
        assert res.id == created.id

    def test_get_entity_ref(self, metadata, mlmodel_request, create_mlmodel):
        """
        Test retrieving EntityReference for an ML model
        """
        created = create_mlmodel(mlmodel_request)
        entity_ref = metadata.get_entity_reference(
            entity=MlModel, fqn=created.fullyQualifiedName
        )

        assert created.id == entity_ref.id
