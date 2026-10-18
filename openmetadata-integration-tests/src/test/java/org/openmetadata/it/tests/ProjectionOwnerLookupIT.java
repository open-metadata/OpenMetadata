/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.jdbi.v3.sqlobject.HandlerDecorators;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.projection.EntityMutation;
import org.openmetadata.service.projection.EntityMutationCapture;
import org.openmetadata.service.projection.ProjectionOwnerLookup;
import org.openmetadata.service.projection.ProjectionOwnerLookup.Owner;
import org.openmetadata.service.projection.ProjectionOwnerLookup.Source;
import org.openmetadata.service.util.FullyQualifiedName;

@Execution(ExecutionMode.SAME_THREAD)
class ProjectionOwnerLookupIT {
  private static final Map<RdfTestDatabase.Backend, TagUsageCaptureFixture> DATABASES =
      new EnumMap<>(RdfTestDatabase.Backend.class);
  private static final Source TABLES =
      new Source("table", "projection_owner_entity", "fqnHash", true);
  private static final String ROOT = "\"service.name\".db.schema.\"table.name\"";

  @BeforeAll
  static void startDatabases() {
    for (final RdfTestDatabase.Backend backend : RdfTestDatabase.backends().toList()) {
      final TagUsageCaptureFixture fixture = new TagUsageCaptureFixture(backend);
      final boolean mysql = backend == RdfTestDatabase.Backend.MYSQL;
      fixture
          .jdbi()
          .getConfig(HandlerDecorators.class)
          .register(
              new EntityMutationCapture(
                  fixture.journal(),
                  mysql ? ConnectionType.MYSQL : ConnectionType.POSTGRES,
                  type -> "table"));
      final String identifier = mysql ? "JSON_UNQUOTE(JSON_EXTRACT(json, '$.id'))" : "json->>'id'";
      fixture
          .jdbi()
          .useHandle(
              handle ->
                  handle.execute(
                      "CREATE TABLE projection_owner_entity (json "
                          + (mysql ? "JSON" : "JSONB")
                          + " NOT NULL, id VARCHAR(36) "
                          + (mysql ? "COLLATE utf8mb4_unicode_ci " : "")
                          + "GENERATED ALWAYS AS ("
                          + identifier
                          + ") STORED PRIMARY KEY, fqnHash VARCHAR(768) NOT NULL)"));
      DATABASES.put(backend, fixture);
    }
  }

  @AfterAll
  static void stopDatabases() {
    DATABASES.values().forEach(TagUsageCaptureFixture::close);
    DATABASES.clear();
  }

  @BeforeEach
  void clearRows() {
    DATABASES
        .values()
        .forEach(
            fixture -> {
              fixture.clear();
              fixture
                  .jdbi()
                  .useHandle(handle -> handle.execute("DELETE FROM projection_owner_entity"));
            });
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void glossaryColumnUsageResolvesAfterTheTableMovesAndIsDeleted(
      final RdfTestDatabase.Backend backend) {
    final TagUsageCaptureFixture fixture = DATABASES.get(backend);
    final Table table = table(ROOT);
    rawInsert(fixture, table);
    fixture.seed(1, "Glossary.Customer", ROOT + ".\"nested.field\".city");
    fixture.dao().deleteTagLabels(1, "Glossary.Customer");
    final String target = fixture.retained().getFirst().targetFqnHash();
    final OwnerDAO dao = fixture.jdbi().onDemand(OwnerDAO.class);
    table.setFullyQualifiedName("service.db.schema.renamed");
    dao.update(table);
    dao.delete(table.getId());
    assertEquals(0, fixture.count("projection_owner_entity"));
    assertEquals(
        List.of(new Owner(table.getId(), "table")), lookup(fixture).page(TABLES, target, null, 10));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void currentUnmodifiedOwnersNeedNoJournalBootstrapToResolve(
      final RdfTestDatabase.Backend backend) {
    final TagUsageCaptureFixture fixture = DATABASES.get(backend);
    final Table table = table(ROOT);
    rawInsert(fixture, table);
    assertEquals(0, fixture.count("metadata_projection_mutation"));
    assertEquals(
        List.of(new Owner(table.getId(), "table")),
        lookup(fixture).page(TABLES, hash(ROOT + ".field"), null, 10));
    final Source exactOnly = new Source("table", TABLES.table(), TABLES.hashColumn(), false);
    assertTrue(lookup(fixture).page(exactOnly, hash(ROOT + ".field"), null, 10).isEmpty());
    assertEquals(
        List.of(new Owner(table.getId(), "table")),
        lookup(fixture).page(exactOnly, hash(ROOT), null, 10));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void nameReuseRetainsBothOwnersAndDeduplicatesRepeatedHistory(
      final RdfTestDatabase.Backend backend) {
    final TagUsageCaptureFixture fixture = DATABASES.get(backend);
    final OwnerDAO dao = fixture.jdbi().onDemand(OwnerDAO.class);
    final Table before = table(ROOT);
    dao.insert(before, ROOT);
    dao.delete(before.getId());
    final Table replacement = table(ROOT);
    dao.insert(replacement, ROOT);
    dao.update(replacement);
    final Set<Owner> expected =
        Set.of(new Owner(before.getId(), "table"), new Owner(replacement.getId(), "table"));
    final var first = lookup(fixture).page(TABLES, hash(ROOT + ".field"), null, 1);
    final var second =
        lookup(fixture).page(TABLES, hash(ROOT + ".field"), first.getFirst().id(), 1);
    assertEquals(expected, Set.of(first.getFirst(), second.getFirst()));
    assertTrue(
        lookup(fixture).page(TABLES, hash(ROOT + ".field"), second.getFirst().id(), 1).isEmpty());
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void historicalNamesAreScopedByEntityType(final RdfTestDatabase.Backend backend) {
    final TagUsageCaptureFixture fixture = DATABASES.get(backend);
    fixture
        .jdbi()
        .useTransaction(
            handle ->
                fixture
                    .journal()
                    .capture(
                        handle,
                        new EntityMutation(
                            1,
                            "topic",
                            UUID.randomUUID(),
                            EntityMutation.Operation.DELETE,
                            ROOT,
                            null)));
    assertTrue(lookup(fixture).page(TABLES, hash(ROOT + ".field"), null, 10).isEmpty());
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void usageRetainedBeforeChainedPrefixRewritesResolvesAfterDeletion(
      final RdfTestDatabase.Backend backend) {
    final TagUsageCaptureFixture fixture = DATABASES.get(backend);
    final OwnerDAO dao = fixture.jdbi().onDemand(OwnerDAO.class);
    final Table table = table("service.db.schema.orders");
    rawInsert(fixture, table);
    final String retained = hash("service.db.schema.orders.city");
    dao.updateFqn("service.db", "service.warehouse");
    dao.updateFqn("service.warehouse.schema", "service.warehouse.sales");
    dao.updateFqn("service.warehouse", "service.db");
    assertEquals(
        hash("service.db.sales.orders"),
        fixture
            .jdbi()
            .withHandle(
                handle ->
                    handle
                        .createQuery("SELECT fqnHash FROM projection_owner_entity")
                        .mapTo(String.class)
                        .one()));
    dao.delete(table.getId());
    assertEquals(
        List.of(new Owner(table.getId(), "table")),
        lookup(fixture).page(TABLES, retained, null, 10));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void prefixFactsAreNotOwnersThemselves(final RdfTestDatabase.Backend backend) {
    final TagUsageCaptureFixture fixture = DATABASES.get(backend);
    final Table table = table(ROOT);
    rawInsert(fixture, table);
    fixture.jdbi().onDemand(OwnerDAO.class).updateFqn(ROOT, "service.other");
    assertEquals(1, fixture.count("metadata_projection_mutation"));
    assertEquals(
        List.of(new Owner(table.getId(), "table")),
        lookup(fixture).page(TABLES, hash(ROOT), null, 10));
  }

  private static Table table(final String fqn) {
    return new Table()
        .withId(UUID.randomUUID())
        .withName("table.name")
        .withFullyQualifiedName(fqn)
        .withVersion(0.1);
  }

  private static void rawInsert(final TagUsageCaptureFixture fixture, final Table table) {
    fixture
        .jdbi()
        .useHandle(
            handle ->
                handle.execute(
                    "INSERT INTO projection_owner_entity (fqnHash, json) VALUES (?, CAST(? AS JSON))",
                    hash(table.getFullyQualifiedName()),
                    JsonUtils.pojoToJson(table)));
  }

  private static ProjectionOwnerLookup lookup(final TagUsageCaptureFixture fixture) {
    return new ProjectionOwnerLookup(fixture.jdbi());
  }

  private static String hash(final String fqn) {
    return FullyQualifiedName.buildHash(fqn);
  }

  public interface OwnerDAO extends EntityDAO<Table> {
    @Override
    default String getTableName() {
      return "projection_owner_entity";
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    @Override
    default Class<Table> getEntityClass() {
      return Table.class;
    }

    default void insertRaw(final Table table) {
      raw(FullyQualifiedName.buildHash(table.getFullyQualifiedName()), JsonUtils.pojoToJson(table));
    }

    @ConnectionAwareSqlUpdate(
        value = "INSERT INTO projection_owner_entity (fqnHash, json) VALUES (:hash, :json)",
        connectionType = ConnectionType.MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO projection_owner_entity (fqnHash, json) VALUES (:hash, CAST(:json AS JSONB))",
        connectionType = ConnectionType.POSTGRES)
    void raw(@Bind("hash") String hash, @Bind("json") String json);
  }
}
