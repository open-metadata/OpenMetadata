"""
Integration tests for SDK entity operations with a running OpenMetadata server.
Exercises follower management, restore/version flows, and metadata enrichment
(tags, glossary terms, owners, domains, data products, CSV helpers) using the
fluent SDK classes only.
"""
from __future__ import annotations

import time
import unittest
from typing import Any, Iterable

import pytest

import metadata.sdk as om
from metadata.generated.schema.api.classification.createClassification import (
    CreateClassificationRequest,
)
from metadata.generated.schema.api.classification.createTag import CreateTagRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createGlossary import CreateGlossaryRequest
from metadata.generated.schema.api.data.createGlossaryTerm import (
    CreateGlossaryTermRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.domains.createDataProduct import (
    CreateDataProductRequest,
)
from metadata.generated.schema.api.domains.createDomain import CreateDomainRequest
from metadata.generated.schema.api.services.createDashboardService import (
    CreateDashboardServiceRequest,
)
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.api.teams.createTeam import CreateTeamRequest
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.domains.domain import DomainType
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardServiceType,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseServiceType,
)
from metadata.generated.schema.entity.teams.team import TeamType
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.type.basic import Markdown
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagLabel,
    TagSource,
)
from metadata.sdk.api.lineage import Lineage
from metadata.sdk.api.search import Search


def _coerce_str(value: Any) -> str:
    if value is None:
        return ""
    root = getattr(value, "root", None)
    return str(root) if root is not None else str(value)


def _to_entity_list(value: Any) -> list[EntityReference]:
    if value is None:
        return []
    root = getattr(value, "root", None)
    if root is not None and isinstance(root, list):
        return list(root)
    if isinstance(value, list):
        return value
    return [value]


class TestSDKIntegration(unittest.TestCase):
    """Integration tests for SDK entity operations"""

    @classmethod
    def setUpClass(cls) -> None:
        cls.service = None
        cls.database = None
        cls.schema = None
        cls.ingestion_bot = None
        cls.team = None
        cls.domain = None
        cls.data_product = None
        cls.dashboard_service = None
        cls.classification = None
        cls.tag = None
        cls.glossary = None
        cls.glossary_term = None

        try:
            om.configure(
                server_url="http://localhost:8585/api",
                jwt_token="eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJvcGVuLW1ldGFkYXRhLm9yZyIsInN1YiI6ImluZ2VzdGlvbi1ib3QiLCJyb2xlcyI6WyJJbmdlc3Rpb25Cb3RSb2xlIl0sImVtYWlsIjoiaW5nZXN0aW9uLWJvdEBvcGVuLW1ldGFkYXRhLm9yZyIsImlzQm90Ijp0cnVlLCJ0b2tlblR5cGUiOiJCT1QiLCJpYXQiOjE3NTg1OTQwNjYsImV4cCI6bnVsbH0.EUQFtIi3Wi3JVaHf5K4trF6AN6jIwKHDiOGeVBJ4aRNqzBF3SlbU6pZW7wgfB-3sLJG5OYWLSr8WwsiEujM3SHfalgG6449aBnyQm-Adg0VGYB3jcm8Lcu54lM0AtFVcAHcXyVVTo-nYT5gi5Dc6Rym6qM1t__Ka1TPBaXA4DNwF4oGNbG16qBCqO_5Iq5QfLlemY_VHP6v1jEEVIsfGpUzr_8qHr3vHq47Co0FOKw2_9ZzDRQe75TqSU-LqfYWciQOuXafK8fA7r5pYZQAVE0v0rK0r5LZ3u3ia4AINsv6F45Hu6PyVSzYf1bZAGt1H-R-aHcc1MP-CxZare1zVog",
            )

            unique_suffix = int(time.time())

            cls.service = om.DatabaseServices.create(
                CreateDatabaseServiceRequest(
                    name=f"test_sdk_service_{unique_suffix}",
                    serviceType=DatabaseServiceType.Mysql,
                    connection=DatabaseConnection(
                        config=MysqlConnection(
                            username="test",
                            authType=BasicAuth(password="test"),
                            hostPort="localhost:3306",
                        )
                    ),
                )
            )

            cls.database = om.Databases.create(
                CreateDatabaseRequest(
                    name=f"test_sdk_db_{unique_suffix}",
                    service=cls.service.fullyQualifiedName,
                )
            )

            cls.schema = om.DatabaseSchemas.create(
                CreateDatabaseSchemaRequest(
                    name=f"test_sdk_schema_{unique_suffix}",
                    database=cls.database.fullyQualifiedName,
                )
            )

            cls.ingestion_bot = cls._safe_retrieve_user("ingestion-bot")

            cls.team = om.Teams.create(
                CreateTeamRequest(
                    name=f"test_sdk_team_{unique_suffix}",
                    teamType=TeamType.Group,
                )
            )

            cls.domain = om.Domains.create(
                CreateDomainRequest(
                    name=f"test_sdk_domain_{unique_suffix}",
                    displayName="SDK Domain",
                    description="Domain created by SDK integration tests",
                    domainType=DomainType.Source_aligned,
                )
            )

            cls.data_product = om.DataProducts.create(
                CreateDataProductRequest(
                    name=f"test_sdk_data_product_{unique_suffix}",
                    displayName="SDK Data Product",
                    description="Data product created by SDK integration tests",
                    domains=[cls.domain.fullyQualifiedName.root],
                )
            )

            cls.dashboard_service = om.DashboardServices.create(
                CreateDashboardServiceRequest(
                    name=f"test_sdk_dashboard_service_{unique_suffix}",
                    serviceType=DashboardServiceType.Superset,
                )
            )

            cls.classification_name = f"TestSDKClassification{unique_suffix}"
            cls.classification = om.Classifications.create(
                CreateClassificationRequest(
                    name=cls.classification_name,
                    description="SDK integration classification",
                )
            )
            cls.tag_name = f"testTag{unique_suffix}"
            cls.tag = om.Tags.create(
                CreateTagRequest(
                    classification=cls.classification_name,
                    name=cls.tag_name,
                    description="SDK integration tag",
                )
            )
            cls.classification_tag_fqn = f"{cls.classification_name}.{cls.tag_name}"

            cls.glossary = om.Glossaries.create(
                CreateGlossaryRequest(
                    name=f"test_sdk_glossary_{unique_suffix}",
                    displayName="SDK Glossary",
                    description="Glossary created by SDK integration tests",
                )
            )
            cls.glossary_term = om.GlossaryTerms.create(
                CreateGlossaryTermRequest(
                    glossary=cls.glossary.fullyQualifiedName.root,
                    name=f"test_sdk_term_{unique_suffix}",
                    displayName="SDK Glossary Term",
                    description="Glossary term for SDK integration tests",
                )
            )
        except Exception as exc:  # pragma: no cover - environment dependent
            om.reset()
            raise unittest.SkipTest(
                f"OpenMetadata server not reachable or misconfigured for SDK integration tests: {exc}"
            ) from exc

    @classmethod
    def tearDownClass(cls) -> None:
        cleanup_targets: Iterable[tuple[Any, Any]] = [
            (om.DataProducts, getattr(cls, "data_product", None)),
            (om.GlossaryTerms, getattr(cls, "glossary_term", None)),
            (om.Glossaries, getattr(cls, "glossary", None)),
            (om.Tags, getattr(cls, "tag", None)),
            (om.Classifications, getattr(cls, "classification", None)),
            (om.Teams, getattr(cls, "team", None)),
            (om.Domains, getattr(cls, "domain", None)),
            (om.DatabaseSchemas, getattr(cls, "schema", None)),
            (om.Databases, getattr(cls, "database", None)),
            (om.DatabaseServices, getattr(cls, "service", None)),
            (om.DashboardServices, getattr(cls, "dashboard_service", None)),
        ]
        for entity_cls, entity in cleanup_targets:
            if entity is None:
                continue
            try:
                entity_cls.delete(entity.id)
            except Exception as exc:  # pragma: no cover - best-effort cleanup
                print(f"Cleanup error for {entity_cls.__name__}: {exc}")

    def setUp(self) -> None:
        self.test_table_name = f"test_table_{int(time.time() * 1000)}"

    @staticmethod
    def _safe_retrieve_user(name: str) -> User | None:
        try:
            return om.Users.retrieve_by_name(name)
        except Exception:
            user_page = om.Users.list(limit=50)
            for candidate in getattr(user_page, "entities", []):
                if getattr(candidate, "name", None) == name:
                    return candidate
            return None

    def _create_basic_table(self, name: str | None = None) -> Table:
        table_name = name or self.test_table_name
        request = CreateTableRequest(
            name=table_name,
            databaseSchema=self.schema.fullyQualifiedName,
            columns=[
                Column(
                    name="id",
                    dataType=DataType.BIGINT,
                    description="Primary key",
                )
            ],
        )
        table = om.Tables.create(request)
        self.assertIsNotNone(table.id)
        return table

    def test_add_remove_followers(self) -> None:
        table = self._create_basic_table()
        try:
            follower = self.ingestion_bot or self._safe_retrieve_user("ingestion-bot")
            if follower is None:
                self.skipTest("ingestion-bot user not available")

            try:
                om.Tables.add_followers(str(table.id.root), [str(follower.id.root)])
            except Exception as exc:  # noqa: BLE001 - depends on server config
                pytest.skip(f"Follower API not supported in this environment: {exc}")

            table_with_followers = om.Tables.retrieve(
                table.id.root, fields=["followers"]
            )
            self.assertTrue(_to_entity_list(table_with_followers.followers))

            om.Tables.remove_followers(str(table.id.root), [str(follower.id.root)])
            table_after_remove = om.Tables.retrieve(table.id.root, fields=["followers"])
            follower_count = len(_to_entity_list(table_after_remove.followers))
            self.assertEqual(follower_count, 0)
        finally:
            om.Tables.delete(str(table.id.root), hard_delete=True)

    def test_table_metadata_enrichment(self) -> None:
        table = self._create_basic_table()
        try:
            working_table = om.Tables.retrieve(
                table.id.root,
                fields=["owners", "tags", "domains", "dataProducts"],
            )

            team_owner = EntityReference(
                id=self.__class__.team.id,
                type="team",
                name=_coerce_str(getattr(self.__class__.team, "name", None)),
                fullyQualifiedName=_coerce_str(
                    getattr(self.__class__.team, "fullyQualifiedName", None)
                ),
            )
            working_table.owners = EntityReferenceList(root=[team_owner])

            if self.ingestion_bot is not None:
                user_owner = EntityReference(
                    id=self.ingestion_bot.id,
                    type="user",
                    name=_coerce_str(getattr(self.ingestion_bot, "name", None)),
                    fullyQualifiedName=_coerce_str(
                        getattr(self.ingestion_bot, "fullyQualifiedName", None)
                    ),
                )
            else:
                user_owner = None

            working_table.tags = [
                TagLabel(
                    tagFQN=self.__class__.classification_tag_fqn,
                    source=TagSource.Classification,
                    labelType=LabelType.Manual,
                    state=State.Confirmed,
                ),
                TagLabel(
                    tagFQN=getattr(
                        getattr(
                            self.__class__.glossary_term, "fullyQualifiedName", None
                        ),
                        "root",
                        "",
                    ),
                    source=TagSource.Glossary,
                    labelType=LabelType.Manual,
                    state=State.Confirmed,
                ),
            ]

            working_table.domains = EntityReferenceList(
                root=[
                    EntityReference(
                        id=self.__class__.domain.id,
                        type="domain",
                        name=_coerce_str(getattr(self.__class__.domain, "name", None)),
                        fullyQualifiedName=_coerce_str(
                            getattr(self.__class__.domain, "fullyQualifiedName", None)
                        ),
                    )
                ]
            )

            working_table.dataProducts = EntityReferenceList(
                root=[
                    EntityReference(
                        id=self.__class__.data_product.id,
                        type="dataProduct",
                        name=_coerce_str(
                            getattr(self.__class__.data_product, "name", None)
                        ),
                        fullyQualifiedName=_coerce_str(
                            getattr(
                                self.__class__.data_product, "fullyQualifiedName", None
                            )
                        ),
                    )
                ]
            )

            om.Tables.update(working_table)

            enriched = om.Tables.retrieve(
                table.id.root,
                fields=["owners", "tags", "domains", "dataProducts"],
            )

            self.assertIsNotNone(enriched.owners)
            owner_types = {owner.type for owner in enriched.owners.root}
            self.assertIn("team", owner_types)

            tag_fqns = {_coerce_str(tag.tagFQN) for tag in enriched.tags or []}
            self.assertIn(self.__class__.classification_tag_fqn, tag_fqns)
            self.assertIn(
                _coerce_str(self.__class__.glossary_term.fullyQualifiedName),
                tag_fqns,
            )

            self.assertIsNotNone(enriched.domains)
            self.assertEqual(len(enriched.domains.root), 1)
            self.assertEqual(
                enriched.domains.root[0].id.root,
                self.__class__.domain.id.root,
            )

            self.assertIsNotNone(enriched.dataProducts)
            self.assertEqual(len(enriched.dataProducts.root), 1)
            self.assertEqual(
                enriched.dataProducts.root[0].id.root,
                self.__class__.data_product.id.root,
            )

            exporter = om.Tables.export_csv(enriched.fullyQualifiedName.root)
            csv_data = exporter.execute()
            self.assertTrue(csv_data.strip())

            importer = om.Tables.import_csv(enriched.fullyQualifiedName.root)
            dry_run_result = importer.with_data(csv_data).set_dry_run(True).execute()
            self.assertIsNotNone(dry_run_result)

            if user_owner is not None:
                owner_update = enriched.model_copy(deep=True)
                owner_update.owners = EntityReferenceList(root=[user_owner])
                om.Tables.update(owner_update)

                user_enriched = om.Tables.retrieve(
                    table.id.root,
                    fields=["owners"],
                )
                user_owner_types = {owner.type for owner in user_enriched.owners.root}
                self.assertEqual(user_owner_types, {"user"})
        finally:
            om.Tables.delete(str(table.id.root), hard_delete=True)

    def test_get_versions(self) -> None:
        table = self._create_basic_table()
        try:
            modified_table = table.model_copy(deep=True)
            modified_table.description = Markdown("Updated description")
            om.Tables.update(modified_table)

            versions = om.Tables.get_versions(str(table.id.root))
            self.assertIsNotNone(versions)
            if isinstance(versions, list):
                self.assertGreater(len(versions), 0)
                if len(versions) > 1:
                    om.Tables.get_specific_version(str(table.id.root), "0.1")
        finally:
            om.Tables.delete(str(table.id.root), hard_delete=True)

    def test_restore_soft_deleted_table(self) -> None:
        table = self._create_basic_table()
        table_id = str(table.id.root)
        try:
            om.Tables.delete(table_id, hard_delete=False)
            time.sleep(2)

            try:
                om.Tables.retrieve(table_id)
                self.skipTest("Soft delete not enabled for tables")
            except Exception:
                pass

            try:
                restored_table = om.Tables.restore(table_id)
            except Exception as exc:  # noqa: BLE001 - depends on server config
                pytest.skip(f"Restore API not supported in this environment: {exc}")
            self.assertIsNotNone(restored_table)
            self.assertFalse(getattr(restored_table, "deleted", False))
        finally:
            try:
                om.Tables.delete(table_id, hard_delete=True)
            except Exception as cleanup_error:  # pragma: no cover
                print(f"Cleanup error: {cleanup_error}")

    def test_update_and_version_tracking(self) -> None:
        table = self._create_basic_table()
        try:
            initial_versions = om.Tables.get_versions(str(table.id.root))
            initial_count = len(initial_versions) if initial_versions else 0

            modified_table = table.model_copy(deep=True)
            modified_table.description = Markdown("First update")
            om.Tables.update(modified_table)
            time.sleep(0.5)

            modified_table.description = Markdown("Second update")
            om.Tables.update(modified_table)
            time.sleep(0.5)

            final_versions = om.Tables.get_versions(str(table.id.root))
            final_count = len(final_versions) if final_versions else 0
            self.assertGreater(final_count, initial_count)
        finally:
            om.Tables.delete(str(table.id.root), hard_delete=True)

    def test_table_lineage_round_trip(self) -> None:
        source = self._create_basic_table(name=f"{self.test_table_name}_source")
        target = self._create_basic_table(name=f"{self.test_table_name}_target")
        try:
            Lineage.add_lineage(
                from_entity_id=source.id.root,
                from_entity_type="table",
                to_entity_id=target.id.root,
                to_entity_type="table",
                description="SDK lineage edge",
            )

            lineage = Lineage.get_entity_lineage(
                Table,
                target.id.root,
                upstream_depth=1,
                downstream_depth=0,
            )
            self.assertIsNotNone(lineage)
            self.assertEqual(
                str(target.id.root),
                _coerce_str(getattr(lineage.entity, "id", None)),
            )
            node_fqns = {
                _coerce_str(getattr(node, "fullyQualifiedName", None))
                for node in getattr(lineage, "nodes", []) or []
            }
            self.assertIn(_coerce_str(source.fullyQualifiedName), node_fqns)

            upstream_ids = {
                _coerce_str(getattr(edge, "fromEntity", None))
                for edge in getattr(lineage, "upstreamEdges", []) or []
            }
            self.assertIn(str(source.id.root), upstream_ids)
        finally:
            om.Tables.delete(str(target.id.root), hard_delete=True)
            om.Tables.delete(str(source.id.root), hard_delete=True)

    def test_table_list_pagination(self) -> None:
        first = self._create_basic_table(name=f"{self.test_table_name}_p1")
        second = self._create_basic_table(name=f"{self.test_table_name}_p2")
        created_tables = [first, second]
        filters = {
            "databaseSchema": _coerce_str(self.__class__.schema.fullyQualifiedName)
        }
        try:
            after = None
            seen = set()
            for _ in range(6):
                page = om.Tables.list(limit=1, after=after, filters=filters)
                self.assertLessEqual(len(page.entities), 1)
                if page.entities:
                    seen.add(_coerce_str(page.entities[0].fullyQualifiedName))
                if not page.after:
                    break
                after = page.after
                self.assertIsInstance(after, str)
                self.assertNotEqual(after, "")

            expected_fqns = {
                _coerce_str(tbl.fullyQualifiedName) for tbl in created_tables
            }
            self.assertTrue(expected_fqns.issubset(seen))
        finally:
            for tbl in created_tables:
                om.Tables.delete(str(tbl.id.root), hard_delete=True)

    def test_dashboard_restore_soft_deleted(self) -> None:
        dashboard = om.Dashboards.create(
            CreateDashboardRequest(
                name=f"test_sdk_dashboard_{int(time.time() * 1000)}",
                service=self.__class__.dashboard_service.fullyQualifiedName,
            )
        )
        dashboard_id = str(dashboard.id.root)
        try:
            om.Dashboards.delete(dashboard_id, hard_delete=False)
            time.sleep(2)

            restored = om.Dashboards.restore(dashboard_id)
            self.assertIsNotNone(restored)
            self.assertEqual(str(restored.id.root), dashboard_id)
        finally:
            om.Dashboards.delete(dashboard_id, hard_delete=True)

    def test_glossary_csv_export_import(self) -> None:
        glossary_name = _coerce_str(self.__class__.glossary.fullyQualifiedName)
        exporter = om.Glossaries.export_csv(glossary_name)
        csv_payload = exporter.execute()
        self.assertTrue(csv_payload.strip())

        importer = om.Glossaries.import_csv(glossary_name)
        dry_run = importer.with_data(csv_payload).set_dry_run(True).execute()
        self.assertIsInstance(dry_run, dict)

    def test_table_tag_reassignment(self) -> None:
        table = self._create_basic_table()
        try:
            working_table = om.Tables.retrieve(
                table.id.root,
                fields=["tags"],
            )
            working_table.tags = [
                TagLabel(
                    tagFQN=self.__class__.classification_tag_fqn,
                    source=TagSource.Classification,
                    labelType=LabelType.Manual,
                    state=State.Confirmed,
                )
            ]
            om.Tables.update(working_table)

            initial = om.Tables.retrieve(table.id.root, fields=["tags"])
            initial_fqns = {_coerce_str(tag.tagFQN) for tag in initial.tags or []}
            self.assertIn(self.__class__.classification_tag_fqn, initial_fqns)

            replacement_tag_name = f"testReplacementTag_{int(time.time() * 1000)}"
            replacement_tag = om.Tags.create(
                CreateTagRequest(
                    classification=self.__class__.classification_name,
                    name=replacement_tag_name,
                    description="Replacement SDK tag",
                )
            )
            replacement_fqn = (
                f"{self.__class__.classification_name}.{replacement_tag_name}"
            )
            try:
                working_table = initial.model_copy(deep=True)
                working_table.tags = [
                    TagLabel(
                        tagFQN=replacement_fqn,
                        source=TagSource.Classification,
                        labelType=LabelType.Manual,
                        state=State.Confirmed,
                    )
                ]
                om.Tables.update(working_table)

                final = om.Tables.retrieve(table.id.root, fields=["tags"])
                final_fqns = {_coerce_str(tag.tagFQN) for tag in final.tags or []}
                self.assertIn(replacement_fqn, final_fqns)
                self.assertNotIn(self.__class__.classification_tag_fqn, final_fqns)
            finally:
                om.Tags.delete(replacement_tag.id)
        finally:
            om.Tables.delete(str(table.id.root), hard_delete=True)

    # ------------------------------------------------------------------ #
    #  Search with friendly dict filters
    # ------------------------------------------------------------------ #
    def test_search_with_dict_filters(self) -> None:
        table = self._create_basic_table()
        try:
            time.sleep(2)
            service_name = _coerce_str(self.__class__.service.fullyQualifiedName)
            results = Search.search(
                query="*",
                index="table_search_index",
                filters={"service.name": service_name},
                size=20,
            )
            self.assertIsInstance(results, dict)
            hits = results.get("hits", {}).get("hits", [])
            self.assertGreater(len(hits), 0)
        finally:
            om.Tables.delete(str(table.id.root), hard_delete=True)

    # ------------------------------------------------------------------ #
    #  Regression: search_advanced must not return 405
    # ------------------------------------------------------------------ #
    def test_search_advanced(self) -> None:
        table = self._create_basic_table()
        try:
            time.sleep(2)
            service_name = _coerce_str(self.__class__.service.fullyQualifiedName)
            results = Search.search_advanced(
                {
                    "query": {
                        "bool": {
                            "must": [{"match_all": {}}],
                            "filter": [{"term": {"service.name": service_name}}],
                        }
                    }
                }
            )
            self.assertIsInstance(results, dict)
        finally:
            om.Tables.delete(str(table.id.root), hard_delete=True)

    # ------------------------------------------------------------------ #
    #  Regression: delete_lineage must build EntitiesEdge, not pass kwargs
    # ------------------------------------------------------------------ #
    def test_delete_lineage(self) -> None:
        source = self._create_basic_table(name=f"{self.test_table_name}_del_src")
        target = self._create_basic_table(name=f"{self.test_table_name}_del_tgt")
        try:
            Lineage.add_lineage(
                from_entity_id=source.id.root,
                from_entity_type="table",
                to_entity_id=target.id.root,
                to_entity_type="table",
            )

            lineage_before = Lineage.get_entity_lineage(
                Table, target.id.root, upstream_depth=1, downstream_depth=0
            )
            self.assertIsNotNone(lineage_before)
            self.assertTrue(getattr(lineage_before, "upstreamEdges", None))

            Lineage.delete_lineage(
                from_entity=str(source.id.root),
                from_entity_type="table",
                to_entity=str(target.id.root),
                to_entity_type="table",
            )

            lineage_after = Lineage.get_entity_lineage(
                Table, target.id.root, upstream_depth=1, downstream_depth=0
            )
            upstream_after = getattr(lineage_after, "upstreamEdges", None) or []
            self.assertEqual(len(upstream_after), 0)
        finally:
            om.Tables.delete(str(target.id.root), hard_delete=True)
            om.Tables.delete(str(source.id.root), hard_delete=True)

    # ------------------------------------------------------------------ #
    #  Regression: custom properties with Pydantic UUID (table.id)
    # ------------------------------------------------------------------ #
    def test_custom_properties_with_pydantic_uuid(self) -> None:
        table = self._create_basic_table()
        try:
            updated = (
                om.Tables.update_custom_properties(table.id)
                .with_property("department", "Data Engineering")
                .execute()
            )
            self.assertIsNotNone(updated)
            ext = getattr(updated, "extension", None)
            self.assertIsNotNone(ext)
            root = getattr(ext, "root", ext)
            self.assertEqual(root.get("department"), "Data Engineering")

            updated2 = (
                om.Tables.update_custom_properties(table.id)
                .with_property("department", "Analytics")
                .with_property("priority", "high")
                .execute()
            )
            ext2 = getattr(updated2, "extension", None)
            root2 = getattr(ext2, "root", ext2)
            self.assertEqual(root2.get("department"), "Analytics")
            self.assertEqual(root2.get("priority"), "high")
        finally:
            om.Tables.delete(str(table.id.root), hard_delete=True)

    # ------------------------------------------------------------------ #
    #  Regression: get_versions with Pydantic UUID (table.id)
    # ------------------------------------------------------------------ #
    def test_get_versions_with_pydantic_uuid(self) -> None:
        table = self._create_basic_table()
        try:
            modified = table.model_copy(deep=True)
            modified.description = Markdown("Version tracking test")
            om.Tables.update(modified)

            versions = om.Tables.get_versions(table.id)
            self.assertIsNotNone(versions)
            self.assertGreater(len(versions), 0)

            specific = om.Tables.get_specific_version(table.id, "0.1")
            self.assertIsNotNone(specific)
        finally:
            om.Tables.delete(str(table.id.root), hard_delete=True)

    # ------------------------------------------------------------------ #
    #  Regression: CSV export should return clean string, no ERROR log
    # ------------------------------------------------------------------ #
    def test_csv_export_no_error_log(self) -> None:
        import logging

        table = self._create_basic_table()
        try:
            schema_fqn = _coerce_str(self.__class__.schema.fullyQualifiedName)

            errors_captured: list[str] = []
            handler = logging.Handler()
            handler.emit = lambda record: (
                errors_captured.append(record.getMessage())
                if record.levelno >= logging.ERROR
                and "json" in record.getMessage().lower()
                else None
            )

            rest_logger = logging.getLogger("OMetaAPI")
            rest_logger.addHandler(handler)
            try:
                exporter = om.DatabaseSchemas.export_csv(schema_fqn)
                csv_content = exporter.execute()
            finally:
                rest_logger.removeHandler(handler)

            self.assertIsInstance(csv_content, str)
            self.assertTrue(csv_content.strip())
            self.assertEqual(
                errors_captured,
                [],
                f"Unexpected JSON decode ERROR logs: {errors_captured}",
            )
        finally:
            om.Tables.delete(str(table.id.root), hard_delete=True)


if __name__ == "__main__":
    unittest.main()
