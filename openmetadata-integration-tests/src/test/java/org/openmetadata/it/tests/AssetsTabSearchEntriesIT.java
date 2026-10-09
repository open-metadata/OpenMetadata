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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.awaitility.core.ConditionTimeoutException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.DatabaseTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.AddGlossaryToAssetsRequest;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.domains.CreateDomain.DomainType;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

/**
 * An Assets tab edit reaches search the way the same PATCH does: a column's own tags are in its
 * search entry when the call returns, and so do the changes the table hands down to its column
 * entries (domains), since the tab's search writes are refreshed before it returns. A table's own
 * tags reach its test cases but never its column entries, which carry only the column's own tags.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class AssetsTabSearchEntriesIT {

  private static final String COLUMN_INDEX = "column_search_index";
  private static final String TABLE_INDEX = "table_search_index";
  private static final String TEST_CASE_INDEX = "test_case_search_index";
  private static final List<String> COLUMNS = List.of("c1", "c2", "c3");
  private static final int ROUNDS = 5;
  private static final int DOMAIN_MOVE_ROUNDS = 10;
  private static final int TABLES_WITH_TEST_CASES = 8;
  private static final Duration PROPAGATION_TIMEOUT = Duration.ofSeconds(30);
  private static final Duration QUIET_WINDOW = Duration.ofSeconds(5);

  /** How the table is labelled: on the term's Assets tab, or by a PATCH on the table's page. */
  enum Route {
    ASSETS_TAB,
    PATCH
  }

  @Test
  void aColumnLabelledOnTheTab_isInItsSearchEntryWhenTheCallReturns(TestNamespace ns) {
    GlossaryTerm term = createTerm(ns, "col");
    Table table = createTable(ns, createSchema(ns), "tbl", null);
    EntityReference column = columnRef(table, COLUMNS.getFirst());

    for (int round = 0; round < ROUNDS; round++) {
      putGlossaryAssets(term, "add", column);
      assertTrue(
          columnEntryCarries(table, COLUMNS.getFirst(), term.getFullyQualifiedName()),
          "round " + round + ": the label is in the column entry on return");
      putGlossaryAssets(term, "remove", column);
      assertFalse(
          columnEntryCarries(table, COLUMNS.getFirst(), term.getFullyQualifiedName()),
          "round " + round + ": the label is gone from the column entry on return");
    }
  }

  @Test
  void aTableMovedToAnotherDomainOnTheTab_reachesItsColumnEntriesOnReturn(TestNamespace ns) {
    // The tab's search writes leave as one bulk write, the table's column entries rebuilt with it,
    // and are refreshed before the call returns.
    Domain from = createDomain(ns, "from");
    Domain to = createDomain(ns, "to");
    Table table = createTable(ns, createSchema(ns), "tbl", null);

    putDomainAssets(from, table);
    assertColumnEntriesIn(table, from);
    putDomainAssets(to, table);
    assertColumnEntriesIn(table, to);
  }

  @Test
  void anAssetJustAddedToADataProduct_followsTheDataProductToItsNewDomain(TestNamespace ns) {
    // The data product's move rewrites its assets' search entries by query. An entry written but
    // not yet searchable when that query runs would keep the old domain for good.
    DatabaseSchema schema = createSchema(ns);
    List<Integer> stale = new ArrayList<>();
    for (int round = 0; round < DOMAIN_MOVE_ROUNDS; round++) {
      Domain from = createDomain(ns, "from" + round);
      Domain to = createDomain(ns, "to" + round);
      DataProduct product = createDataProduct(ns, from, "dp" + round);
      Table table = createTable(ns, schema, "t" + round, from);

      BulkOperationResult result =
          putBulkAssets("/v1/dataProducts/" + product.getFullyQualifiedName(), table);
      assertEquals(ApiStatus.SUCCESS, result.getStatus(), JsonUtils.pojoToJson(result));
      moveDataProduct(product, to);

      if (!tableEntryReaches(table, to)) {
        stale.add(round);
      }
    }
    assertEquals(List.of(), stale, "rounds whose asset kept its old domain in search");
  }

  @ParameterizedTest
  @EnumSource(Route.class)
  void tableLabels_reachTestCasesNotColumns(Route route, TestNamespace ns) {
    GlossaryTerm term = createTerm(ns, "tbl" + route.ordinal());
    DatabaseSchema schema = createSchema(ns);
    List<Table> tables = new ArrayList<>();
    List<TestCase> testCases = new ArrayList<>();
    for (int i = 0; i < TABLES_WITH_TEST_CASES; i++) {
      Table table = createTable(ns, schema, "t" + i, null);
      tables.add(table);
      testCases.add(createTestCase(ns, table, "tc" + i));
    }

    label(route, term, tables);

    Awaitility.await("test cases carry the table's label")
        .pollInterval(Duration.ofMillis(500))
        .atMost(PROPAGATION_TIMEOUT)
        .until(() -> testCases.stream().allMatch(testCase -> testCaseCarries(testCase, term)));
    Awaitility.await("column entries never carry the table's label")
        .pollInterval(Duration.ofSeconds(1))
        .during(QUIET_WINDOW)
        .atMost(QUIET_WINDOW.plusSeconds(10))
        .until(
            () ->
                tables.stream()
                    .flatMap(table -> columnEntries(table).stream())
                    .noneMatch(entry -> carriesTag(entry, term.getFullyQualifiedName())));
  }

  // ---------------------------------------------------------------------------------------------
  // Search checks
  // ---------------------------------------------------------------------------------------------

  private static boolean columnEntryCarries(Table table, String column, String tagFqn) {
    return columnEntries(table).stream()
        .filter(entry -> column.equals(entry.path("name").asText()))
        .anyMatch(entry -> carriesTag(entry, tagFqn));
  }

  private static void assertColumnEntriesIn(Table table, Domain domain) {
    List<JsonNode> entries = columnEntries(table);
    assertEquals(COLUMNS.size(), entries.size(), "one entry per column");
    assertTrue(
        entries.stream().allMatch(entry -> inDomain(entry, domain.getId())),
        "every column entry is in " + domain.getName());
  }

  private static boolean tableEntryReaches(Table table, Domain domain) {
    try {
      Awaitility.await("table entry of " + table.getName() + " in " + domain.getName())
          .pollInterval(Duration.ofMillis(500))
          .atMost(PROPAGATION_TIMEOUT)
          .until(
              () ->
                  hits(TABLE_INDEX, termFilter("id.keyword", table.getId().toString())).stream()
                      .anyMatch(entry -> inDomain(entry, domain.getId())));
      return true;
    } catch (ConditionTimeoutException e) {
      return false;
    }
  }

  private static boolean testCaseCarries(TestCase testCase, GlossaryTerm term) {
    return hits(TEST_CASE_INDEX, termFilter("id.keyword", testCase.getId().toString())).stream()
        .anyMatch(entry -> carriesTag(entry, term.getFullyQualifiedName()));
  }

  private static List<JsonNode> columnEntries(Table table) {
    return hits(COLUMN_INDEX, termFilter("table.id", table.getId().toString()));
  }

  private static boolean carriesTag(JsonNode entry, String tagFqn) {
    for (JsonNode tag : entry.path("tags")) {
      if (tagFqn.equalsIgnoreCase(tag.path("tagFQN").asText())) {
        return true;
      }
    }
    return false;
  }

  private static boolean inDomain(JsonNode entry, UUID domainId) {
    for (JsonNode domain : entry.path("domains")) {
      if (domainId.toString().equals(domain.path("id").asText())) {
        return true;
      }
    }
    return false;
  }

  private static String termFilter(String field, String value) {
    return "{\"query\":{\"bool\":{\"must\":[{\"term\":{\"" + field + "\":\"" + value + "\"}}]}}}";
  }

  private static List<JsonNode> hits(String index, String filter) {
    String response;
    try {
      response =
          SdkClients.adminClient()
              .search()
              .query("*")
              .index(index)
              .queryFilter(filter)
              .size(50)
              .deleted(false)
              .execute();
    } catch (Exception e) {
      throw new IllegalStateException("Search on " + index + " failed", e);
    }
    List<JsonNode> sources = new ArrayList<>();
    JsonUtils.readTree(response)
        .path("hits")
        .path("hits")
        .forEach(hit -> sources.add(hit.path("_source")));
    return sources;
  }

  // ---------------------------------------------------------------------------------------------
  // Calls and fixtures
  // ---------------------------------------------------------------------------------------------

  private static void putGlossaryAssets(GlossaryTerm term, String action, EntityReference asset) {
    BulkOperationResult result =
        SdkClients.user1Client()
            .getHttpClient()
            .execute(
                HttpMethod.PUT,
                "/v1/glossaryTerms/" + term.getId() + "/assets/" + action,
                new AddGlossaryToAssetsRequest().withAssets(List.of(asset)).withDryRun(false),
                BulkOperationResult.class);
    assertEquals(ApiStatus.SUCCESS, result.getStatus(), JsonUtils.pojoToJson(result));
  }

  private static void label(Route route, GlossaryTerm term, List<Table> tables) {
    if (route == Route.ASSETS_TAB) {
      BulkOperationResult result =
          SdkClients.user1Client()
              .getHttpClient()
              .execute(
                  HttpMethod.PUT,
                  "/v1/glossaryTerms/" + term.getId() + "/assets/add",
                  new AddGlossaryToAssetsRequest()
                      .withAssets(tables.stream().map(Table::getEntityReference).toList())
                      .withDryRun(false),
                  BulkOperationResult.class);
      assertEquals(ApiStatus.SUCCESS, result.getStatus(), JsonUtils.pojoToJson(result));
    } else {
      OpenMetadataClient user = SdkClients.user1Client();
      for (Table table : tables) {
        Table current = user.tables().get(table.getId().toString(), "tags");
        current.setTags(List.of(glossaryLabel(term)));
        user.tables().update(table.getId().toString(), current);
      }
    }
  }

  private static void putDomainAssets(Domain domain, Table table) {
    BulkOperationResult result =
        putBulkAssets("/v1/domains/" + domain.getFullyQualifiedName(), table);
    assertEquals(ApiStatus.SUCCESS, result.getStatus(), JsonUtils.pojoToJson(result));
  }

  private static BulkOperationResult putBulkAssets(String containerPath, Table table) {
    return SdkClients.user1Client()
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            containerPath + "/assets/add",
            new BulkAssets().withAssets(List.of(table.getEntityReference())).withDryRun(false),
            BulkOperationResult.class);
  }

  private static void moveDataProduct(DataProduct product, Domain to) {
    DataProduct current =
        SdkClients.adminClient().dataProducts().get(product.getId().toString(), "domains");
    current.setDomains(List.of(to.getEntityReference()));
    SdkClients.adminClient().dataProducts().update(product.getId().toString(), current);
  }

  private static DatabaseSchema createSchema(TestNamespace ns) {
    // Short names: a test case's suite is named after its table's FQN, which has a length limit.
    DatabaseService service =
        DatabaseServiceTestFactory.createPostgresWithName(ns.shortPrefix("svc"), ns);
    Database database =
        DatabaseTestFactory.createWithName(service.getFullyQualifiedName(), ns.shortPrefix("db"));
    return SdkClients.adminClient()
        .databaseSchemas()
        .create(
            new CreateDatabaseSchema()
                .withName(ns.shortPrefix("schema"))
                .withDatabase(database.getFullyQualifiedName()));
  }

  private static Table createTable(
      TestNamespace ns, DatabaseSchema schema, String name, Domain domain) {
    List<Column> columns =
        COLUMNS.stream()
            .map(column -> new Column().withName(column).withDataType(ColumnDataType.STRING))
            .toList();
    return SdkClients.adminClient()
        .tables()
        .create(
            new CreateTable()
                .withName(ns.shortPrefix(name))
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withColumns(columns)
                .withDomains(domain == null ? null : List.of(domain.getFullyQualifiedName())));
  }

  private static TestCase createTestCase(TestNamespace ns, Table table, String name) {
    return TestCaseBuilder.create(SdkClients.adminClient())
        .name(ns.prefix(name))
        .forTable(table)
        .testDefinition("tableRowCountToEqual")
        .parameter("value", "100")
        .create();
  }

  private static TagLabel glossaryLabel(GlossaryTerm term) {
    return new TagLabel()
        .withTagFQN(term.getFullyQualifiedName())
        .withSource(TagLabel.TagSource.GLOSSARY)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }

  private static GlossaryTerm createTerm(TestNamespace ns, String name) {
    Glossary glossary =
        ns.trackRoot(
            Entity.GLOSSARY,
            SdkClients.adminClient()
                .glossaries()
                .create(
                    new CreateGlossary()
                        .withName(ns.shortPrefix("g_" + name))
                        .withDescription("Assets tab search entries")));
    return SdkClients.adminClient()
        .glossaryTerms()
        .create(
            new CreateGlossaryTerm()
                .withName("term")
                .withGlossary(glossary.getFullyQualifiedName())
                .withDescription("Assets tab search entries"));
  }

  private static Domain createDomain(TestNamespace ns, String name) {
    return ns.trackRoot(
        Entity.DOMAIN,
        SdkClients.adminClient()
            .domains()
            .create(
                new CreateDomain()
                    .withName(ns.shortPrefix("dom_" + name))
                    .withDomainType(DomainType.AGGREGATE)
                    .withDescription("Assets tab search entries")));
  }

  private static DataProduct createDataProduct(TestNamespace ns, Domain domain, String name) {
    return SdkClients.adminClient()
        .dataProducts()
        .create(
            new CreateDataProduct()
                .withName(ns.shortPrefix(name))
                .withDomains(List.of(domain.getFullyQualifiedName()))
                .withDescription("Assets tab search entries"));
  }

  private static EntityReference columnRef(Table table, String column) {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType(Entity.TABLE_COLUMN)
        .withFullyQualifiedName(table.getFullyQualifiedName() + "." + column);
  }
}
