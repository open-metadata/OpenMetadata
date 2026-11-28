package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SearchDocs;
import org.openmetadata.it.util.SharedResourceLocks;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateDataContract;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.search.AggregationRequest;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.search.TopHits;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;

/**
 * Verifies that {@code data_contract_search_index} carries the governed entity's effective domains
 * so search RBAC ({@code enableAccessControl = true}) hides other domains' data contracts from
 * domain-only users across query, aggregate, and export endpoints, and keeps contract search
 * documents in sync across direct moves, ancestor moves, DataProduct moves, domain renames, and
 * domain deletes (#39191).
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
@ResourceLock(value = SharedResourceLocks.SEARCH_SETTINGS, mode = ResourceAccessMode.READ_WRITE)
public class DataContractSearchDomainAccessIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String DATA_CONTRACT_INDEX = "dataContract";
  private static final String DATA_CONTRACT_SEARCH_INDEX = "data_contract_search_index";
  private static final RequestOptions JSON_PATCH =
      RequestOptions.builder().header("Content-Type", "application/json-patch+json").build();

  @Test
  void domainOnlyUserOnlyFindsOwnAndDomainlessContractsAcrossSearchEndpoints(TestNamespace ns)
      throws Exception {
    assumeTheServerTrustsHarnessSignedTokens();
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String p = ns.shortPrefix();
      Domain domainA = createDomain(admin, p + "_domain_a", cleanup);
      Domain domainB = createDomain(admin, p + "_domain_b", cleanup);
      DatabaseService service = createDatabaseService(ns, cleanup);
      DatabaseSchema plainSchema = DatabaseSchemaTestFactory.createSimple(ns, service);
      DatabaseSchema domainBSchema =
          createSchemaInDomain(
              admin, plainSchema.getDatabase().getFullyQualifiedName(), p + "_sb", domainB);

      Table ownTable = createTable(admin, plainSchema, p + "_own_tbl", domainA);
      Table domainlessTable = createTable(admin, plainSchema, p + "_free_tbl", null);
      Table foreignTable = createTable(admin, plainSchema, p + "_other_tbl", domainB);
      Table inheritedForeignTable = createTable(admin, domainBSchema, p + "_inh_tbl", null);

      DataContract ownContract = createContract(admin, ownTable, p + "_dc_own");
      DataContract domainlessContract = createContract(admin, domainlessTable, p + "_dc_free");
      DataContract foreignContract = createContract(admin, foreignTable, p + "_dc_other");
      DataContract inheritedContract =
          createContract(admin, inheritedForeignTable, p + "_dc_inherited");

      OpenMetadataClient domainOnlyClient = createTeamDomainOnlyUser(admin, p, domainA, cleanup);
      enableSearchAccessControl(admin, cleanup);

      Set<String> allIds =
          Set.of(
              ownContract.getId().toString(),
              domainlessContract.getId().toString(),
              foreignContract.getId().toString(),
              inheritedContract.getId().toString());
      Set<String> permittedIds =
          Set.of(ownContract.getId().toString(), domainlessContract.getId().toString());
      String query = "*" + p + "_dc_*";

      awaitSearchQuery("admin sees all four contracts", admin, query, false, allIds, allIds.size());
      awaitSearchQuery(
          "domain-only user sees only own and domainless contracts via GET",
          domainOnlyClient,
          query,
          false,
          permittedIds,
          permittedIds.size());

      JsonNode postResponse = searchContractsPost(domainOnlyClient, query);
      assertEquals(permittedIds, hitIds(postResponse), "POST /v1/search/query hit IDs");
      assertEquals(
          permittedIds.size(),
          postResponse.path("hits").path("total").path("value").asLong(),
          "POST /v1/search/query total must not leak hidden contracts");

      JsonNode getAgg = aggregateContractsGet(domainOnlyClient, p + "_dc_.*");
      Set<String> getAggNames = aggregationBucketKeys(getAgg);
      assertTrue(getAggNames.contains(ownContract.getName()), "GET agg: " + getAggNames);
      assertTrue(getAggNames.contains(domainlessContract.getName()), "GET agg: " + getAggNames);
      assertFalse(
          getAggNames.contains(foreignContract.getName()), "GET agg leaked: " + getAggNames);
      assertFalse(
          getAggNames.contains(inheritedContract.getName()), "GET agg leaked: " + getAggNames);

      JsonNode postAgg = aggregateContractsPost(domainOnlyClient, p + "_dc_.*");
      Set<String> postAggNames = aggregationBucketKeys(postAgg);
      assertTrue(postAggNames.contains(ownContract.getName()), "POST agg: " + postAggNames);
      assertTrue(postAggNames.contains(domainlessContract.getName()), "POST agg: " + postAggNames);
      assertFalse(
          postAggNames.contains(foreignContract.getName()), "POST agg leaked: " + postAggNames);
      assertFalse(
          postAggNames.contains(inheritedContract.getName()), "POST agg leaked: " + postAggNames);

      String csv = exportContractsCsv(domainOnlyClient, query);
      assertTrue(csv.contains(ownContract.getFullyQualifiedName()), "CSV missing own: " + csv);
      assertTrue(
          csv.contains(domainlessContract.getFullyQualifiedName()), "CSV missing free: " + csv);
      assertFalse(
          csv.contains(foreignContract.getFullyQualifiedName()), "CSV leaked foreign: " + csv);
      assertFalse(
          csv.contains(inheritedContract.getFullyQualifiedName()), "CSV leaked inherited: " + csv);

      String domainAFilter = "{\"query\":{\"term\":{\"domains.id\":\"" + domainA.getId() + "\"}}}";
      Awaitility.await("ownTable appears in domainA 'all' search without dataContracts")
          .atMost(Duration.ofSeconds(60))
          .pollInterval(Duration.ofSeconds(1))
          .untilAsserted(
              () -> {
                JsonNode domainAAssets = searchIndexGet(admin, "all", "*", false, domainAFilter);
                Set<String> domainAAssetIds = hitIds(domainAAssets);
                assertTrue(
                    domainAAssetIds.contains(ownTable.getId().toString()),
                    "ownTable should appear in domainA 'all' search; got=" + domainAAssetIds);
                assertTrue(
                    allIds.stream().noneMatch(domainAAssetIds::contains),
                    "dataContract documents must not appear in global 'all' domain search; got="
                        + domainAAssetIds);
              });
    } finally {
      drain(cleanup);
    }
  }

  @Test
  void contractSearchAccessFollowsDirectAncestorAndSoftDeleteDomainMoves(TestNamespace ns)
      throws Exception {
    assumeTheServerTrustsHarnessSignedTokens();
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String p = ns.shortPrefix();
      Domain domainA = createDomain(admin, p + "_mv_a", cleanup);
      Domain domainB = createDomain(admin, p + "_mv_b", cleanup);
      DatabaseService service = createDatabaseService(ns, cleanup);
      DatabaseSchema plainSchema = DatabaseSchemaTestFactory.createSimple(ns, service);
      DatabaseSchema movingSchema =
          createSchemaInDomain(
              admin, plainSchema.getDatabase().getFullyQualifiedName(), p + "_mv_schema", domainB);

      Table directTable = createTable(admin, plainSchema, p + "_direct_tbl", domainB);
      Table inheritedTable = createTable(admin, movingSchema, p + "_inh_tbl", null);
      Table explicitForeignTable = createTable(admin, movingSchema, p + "_exp_tbl", domainB);
      Table softDeleteTable = createTable(admin, plainSchema, p + "_del_tbl", domainB);

      DataContract directContract = createContract(admin, directTable, p + "_mv_direct");
      DataContract inheritedContract = createContract(admin, inheritedTable, p + "_mv_inh");
      DataContract explicitContract = createContract(admin, explicitForeignTable, p + "_mv_exp");
      DataContract softDeletedContract = createContract(admin, softDeleteTable, p + "_mv_del");

      admin
          .getHttpClient()
          .executeForString(
              HttpMethod.DELETE,
              "/v1/dataContracts/" + softDeletedContract.getId() + "?hardDelete=false",
              null);

      OpenMetadataClient domainOnlyClient =
          createTeamDomainOnlyUser(admin, p + "_mv", domainA, cleanup);
      enableSearchAccessControl(admin, cleanup);

      String activeQuery = "*" + p + "_mv_*";
      Set<String> activeAllIds =
          Set.of(
              directContract.getId().toString(),
              inheritedContract.getId().toString(),
              explicitContract.getId().toString());
      awaitSearchQuery(
          "admin sees all 3 active contracts", admin, activeQuery, false, activeAllIds, 3);
      awaitSearchQuery(
          "restricted initially sees none", domainOnlyClient, activeQuery, false, Set.of(), 0);

      // Direct move: domainB -> domainA
      replaceDomains(admin, "/v1/tables/" + directTable.getId(), List.of(domainA));
      awaitSearchQuery(
          "direct move into domainA reveals contract",
          domainOnlyClient,
          activeQuery,
          false,
          Set.of(directContract.getId().toString()),
          1);

      // Direct move back to domainB hides it again
      replaceDomains(admin, "/v1/tables/" + directTable.getId(), List.of(domainB));
      awaitSearchQuery(
          "direct move back to domainB hides contract",
          domainOnlyClient,
          activeQuery,
          false,
          Set.of(),
          0);

      // Clearing domain makes it domainless (visible)
      replaceDomains(admin, "/v1/tables/" + directTable.getId(), List.of());
      awaitSearchQuery(
          "clearing domain makes contract domainless and visible",
          domainOnlyClient,
          activeQuery,
          false,
          Set.of(directContract.getId().toString()),
          1);

      // Ancestor schema move: domainB -> domainA reveals inherited contract, keeps explicit
      // override hidden
      replaceDomains(admin, "/v1/databaseSchemas/" + movingSchema.getId(), List.of(domainA));
      awaitSearchQuery(
          "ancestor schema move updates inherited contract and keeps explicit override hidden",
          domainOnlyClient,
          activeQuery,
          false,
          Set.of(directContract.getId().toString(), inheritedContract.getId().toString()),
          2);

      // Soft-deleted contract stays hidden in domainB, then becomes visible after table moves to
      // domainA
      String deletedQuery = "*" + p + "_mv_del*";
      awaitSearchQuery(
          "admin sees soft-deleted contract",
          admin,
          deletedQuery,
          true,
          Set.of(softDeletedContract.getId().toString()),
          1);
      awaitSearchQuery(
          "restricted user does not see foreign soft-deleted contract",
          domainOnlyClient,
          deletedQuery,
          true,
          Set.of(),
          0);
      replaceDomains(admin, "/v1/tables/" + softDeleteTable.getId(), List.of(domainA));
      awaitSearchQuery(
          "soft-deleted contract follows table domain move into domainA",
          domainOnlyClient,
          deletedQuery,
          true,
          Set.of(softDeletedContract.getId().toString()),
          1);
    } finally {
      drain(cleanup);
    }
  }

  @Test
  void contractSearchDomainsFollowDataProductMoveDomainRenameAndDomainDelete(TestNamespace ns)
      throws Exception {
    assumeTheServerTrustsHarnessSignedTokens();
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String p = ns.shortPrefix();
      Domain domainA = createDomain(admin, p + "_dp_a", cleanup);
      Domain domainB = createDomain(admin, p + "_dp_b", cleanup);
      DatabaseService service = createDatabaseService(ns, cleanup);
      DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

      // 1. DataProduct domain move updates contracts on moved assets
      Table dpTable = createTable(admin, schema, p + "_dp_tbl", domainB);
      DataContract dpContract = createContract(admin, dpTable, p + "_dp_dc");
      DataProduct dp = createDataProduct(admin, p + "_dp", domainB, cleanup);
      admin
          .getHttpClient()
          .execute(
              HttpMethod.PUT,
              "/v1/dataProducts/" + dp.getFullyQualifiedName() + "/assets/add",
              new BulkAssets().withAssets(List.of(dpTable.getEntityReference())),
              Void.class);

      OpenMetadataClient domainOnlyClient =
          createTeamDomainOnlyUser(admin, p + "_dp", domainA, cleanup);
      enableSearchAccessControl(admin, cleanup);

      String dpQuery = "*" + p + "_dp_dc*";
      awaitSearchQuery(
          "admin sees data product table contract",
          admin,
          dpQuery,
          false,
          Set.of(dpContract.getId().toString()),
          1);
      awaitSearchQuery(
          "domain-only user cannot see contract while DataProduct is in domainB",
          domainOnlyClient,
          dpQuery,
          false,
          Set.of(),
          0);

      replaceDomains(admin, "/v1/dataProducts/" + dp.getId(), List.of(domainA));
      awaitSearchQuery(
          "moving DataProduct to domainA reveals its asset's data contract",
          domainOnlyClient,
          dpQuery,
          false,
          Set.of(dpContract.getId().toString()),
          1);

      // 2. Domain rename updates domains.fullyQualifiedName and displayName on contract docs
      Domain renameable = createDomain(admin, p + "_ren_before", cleanup);
      Table renamedDomainTable = createTable(admin, schema, p + "_ren_tbl", renameable);
      DataContract renamedDomainContract = createContract(admin, renamedDomainTable, p + "_ren_dc");
      SearchDocs.awaitDoc(
          DATA_CONTRACT_SEARCH_INDEX,
          renamedDomainContract.getId(),
          doc ->
              SearchDocs.fieldValues(doc.path("domains"), "fullyQualifiedName")
                  .contains(renameable.getFullyQualifiedName()));

      String newName = p + "_ren_after";
      String newDisplayName = "Renamed Contract Domain";
      patchJson(
          admin,
          "/v1/domains/" + renameable.getId(),
          "[{\"op\":\"replace\",\"path\":\"/name\",\"value\":\""
              + newName
              + "\"},{\"op\":\"add\",\"path\":\"/displayName\",\"value\":\""
              + newDisplayName
              + "\"}]");

      JsonNode renamedDoc =
          SearchDocs.awaitDoc(
              DATA_CONTRACT_SEARCH_INDEX,
              renamedDomainContract.getId(),
              doc ->
                  SearchDocs.fieldValues(doc.path("domains"), "fullyQualifiedName")
                          .contains(newName)
                      && SearchDocs.fieldValues(doc.path("domains"), "displayName")
                          .contains(newDisplayName));
      assertNotNull(renamedDoc);

      OpenMetadataClient deniedByNewFqn =
          createUserWithDenyCondition(
              admin, p + "_deny_ren", "matchAnyDomain('" + newName + "')", cleanup);
      awaitSearchQuery(
          "matchAnyDomain on renamed FQN denies renamed-domain contract",
          deniedByNewFqn,
          "*" + p + "_ren_dc*",
          false,
          Set.of(),
          0);
      awaitSearchQuery(
          "matchAnyDomain on renamed FQN still allows contract in other domain",
          deniedByNewFqn,
          dpQuery,
          false,
          Set.of(dpContract.getId().toString()),
          1);

      // 3. CSV bulk import domain move updates contract search visibility
      Table csvTable = createTable(admin, schema, p + "_csv_tbl", domainB);
      DataContract csvContract = createContract(admin, csvTable, p + "_csv_dc");
      String csvQuery = "*" + p + "_csv_dc*";
      awaitSearchQuery(
          "admin sees CSV-test contract",
          admin,
          csvQuery,
          false,
          Set.of(csvContract.getId().toString()),
          1);
      awaitSearchQuery(
          "restricted user does not see CSV-test contract while in domainB",
          domainOnlyClient,
          csvQuery,
          false,
          Set.of(),
          0);
      String exportedCsv = admin.databaseSchemas().exportCsv(schema.getFullyQualifiedName());
      String[] csvLines = exportedCsv.split("\\R");
      String csvHeader = csvLines[0];
      String csvRow =
          java.util.Arrays.stream(csvLines)
              .skip(1)
              .filter(line -> line.startsWith(csvTable.getName() + ","))
              .findFirst()
              .orElseThrow(
                  () -> new AssertionError("CSV export missing table row: " + exportedCsv));
      String updatedCsv =
          csvHeader
              + "\n"
              + csvRow.replace(domainB.getFullyQualifiedName(), domainA.getFullyQualifiedName());
      String importJson =
          admin.databaseSchemas().importCsv(schema.getFullyQualifiedName(), updatedCsv, false);
      JsonNode importResult = MAPPER.readTree(importJson);
      assertEquals(
          "success", importResult.path("status").asText(), "CSV import failed: " + importJson);
      assertEquals(
          0,
          importResult.path("numberOfRowsFailed").asInt(-1),
          "CSV import had failed rows: " + importJson);
      awaitSearchQuery(
          "CSV import moving table to domainA reveals its data contract",
          domainOnlyClient,
          csvQuery,
          false,
          Set.of(csvContract.getId().toString()),
          1);

      // 4. Domain hard-delete strips deleted domain from contract search doc
      admin
          .domains()
          .delete(renameable.getId().toString(), Map.of("hardDelete", "true", "recursive", "true"));
      SearchDocs.awaitDoc(
          DATA_CONTRACT_SEARCH_INDEX,
          renamedDomainContract.getId(),
          doc -> doc.path("domains").isArray() && doc.path("domains").isEmpty());
    } finally {
      drain(cleanup);
    }
  }

  private static void awaitSearchQuery(
      String description,
      OpenMetadataClient client,
      String query,
      boolean deleted,
      Set<String> expectedIds,
      long expectedTotal) {
    Awaitility.await(description)
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(1))
        .untilAsserted(
            () -> {
              JsonNode result = searchIndexGet(client, DATA_CONTRACT_INDEX, query, deleted);
              assertEquals(expectedIds, hitIds(result), description + " response=" + result);
              assertEquals(
                  expectedTotal,
                  result.path("hits").path("total").path("value").asLong(),
                  description + " total");
            });
  }

  private static JsonNode searchIndexGet(
      OpenMetadataClient client, String index, String query, boolean deleted) throws Exception {
    return searchIndexGet(client, index, query, deleted, null);
  }

  private static JsonNode searchIndexGet(
      OpenMetadataClient client, String index, String query, boolean deleted, String queryFilter)
      throws Exception {
    RequestOptions.Builder options =
        RequestOptions.builder()
            .queryParam("q", query)
            .queryParam("index", index)
            .queryParam("from", "0")
            .queryParam("size", "50")
            .queryParam("deleted", String.valueOf(deleted));
    if (queryFilter != null) {
      options.queryParam("query_filter", queryFilter);
    }
    String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/search/query", null, options.build());
    return MAPPER.readTree(response);
  }

  private static JsonNode searchContractsPost(OpenMetadataClient client, String query)
      throws Exception {
    SearchRequest request =
        new SearchRequest()
            .withQuery(query)
            .withIndex(DATA_CONTRACT_INDEX)
            .withFrom(0)
            .withSize(50)
            .withDeleted(false);
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, "/v1/search/query", MAPPER.writeValueAsString(request));
    return MAPPER.readTree(response);
  }

  private static JsonNode aggregateContractsGet(OpenMetadataClient client, String fieldValue)
      throws Exception {
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("index", DATA_CONTRACT_INDEX)
            .queryParam("field", "name.keyword")
            .queryParam("value", fieldValue)
            .queryParam("size", "50")
            .build();
    String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/search/aggregate", null, options);
    return MAPPER.readTree(response);
  }

  private static JsonNode aggregateContractsPost(OpenMetadataClient client, String fieldValue)
      throws Exception {
    AggregationRequest request =
        new AggregationRequest()
            .withIndex(DATA_CONTRACT_INDEX)
            .withFieldName("name.keyword")
            .withFieldValue(fieldValue)
            .withQuery("*")
            .withSize(50)
            .withTopHits(new TopHits().withSize(10));
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, "/v1/search/aggregate", MAPPER.writeValueAsString(request));
    return MAPPER.readTree(response);
  }

  private static String exportContractsCsv(OpenMetadataClient client, String query) {
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("q", query)
            .queryParam("index", DATA_CONTRACT_INDEX)
            .queryParam("size", "50")
            .build();
    return client
        .getHttpClient()
        .executeForString(HttpMethod.GET, "/v1/search/export", null, options);
  }

  private static Set<String> hitIds(JsonNode response) {
    Set<String> ids = new HashSet<>();
    for (JsonNode hit : response.path("hits").path("hits")) {
      ids.add(hit.path("_source").path("id").asText());
    }
    return ids;
  }

  private static Set<String> aggregationBucketKeys(JsonNode response) {
    Set<String> keys = new HashSet<>();
    JsonNode aggs = response.path("aggregations");
    aggs.fieldNames()
        .forEachRemaining(
            aggName -> {
              for (JsonNode bucket : aggs.path(aggName).path("buckets")) {
                if (bucket.hasNonNull("key")) {
                  keys.add(bucket.get("key").asText());
                }
              }
            });
    return keys;
  }

  private static Domain createDomain(
      OpenMetadataClient admin, String name, Deque<Runnable> cleanup) {
    Domain domain =
        admin
            .domains()
            .create(
                new CreateDomain()
                    .withName(name)
                    .withDomainType(CreateDomain.DomainType.AGGREGATE)
                    .withDescription("Data contract search domain access test domain"));
    cleanup.push(
        () ->
            admin
                .domains()
                .delete(
                    domain.getId().toString(), Map.of("hardDelete", "true", "recursive", "true")));
    return domain;
  }

  private static DataProduct createDataProduct(
      OpenMetadataClient admin, String name, Domain domain, Deque<Runnable> cleanup) {
    DataProduct dp =
        admin
            .dataProducts()
            .create(
                new CreateDataProduct()
                    .withName(name)
                    .withDescription("Data contract search domain test product")
                    .withDomains(List.of(domain.getFullyQualifiedName())));
    cleanup.push(
        () -> admin.dataProducts().delete(dp.getId().toString(), Map.of("hardDelete", "true")));
    return dp;
  }

  private static DatabaseService createDatabaseService(TestNamespace ns, Deque<Runnable> cleanup) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    cleanup.push(
        () ->
            SdkClients.adminClient()
                .databaseServices()
                .delete(
                    service.getId().toString(), Map.of("recursive", "true", "hardDelete", "true")));
    return service;
  }

  private static DatabaseSchema createSchemaInDomain(
      OpenMetadataClient admin, String databaseFqn, String name, Domain domain) {
    return admin
        .databaseSchemas()
        .create(
            new CreateDatabaseSchema()
                .withName(name)
                .withDatabase(databaseFqn)
                .withDomains(List.of(domain.getFullyQualifiedName())));
  }

  private static Table createTable(
      OpenMetadataClient admin, DatabaseSchema schema, String name, Domain domain) {
    CreateTable create =
        new CreateTable()
            .withName(name)
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.INT)));
    if (domain != null) {
      create.withDomains(List.of(domain.getFullyQualifiedName()));
    }
    return admin.tables().create(create);
  }

  private static DataContract createContract(OpenMetadataClient admin, Table table, String name)
      throws Exception {
    CreateDataContract request =
        new CreateDataContract()
            .withName(name)
            .withDescription("Domain access search contract " + name)
            .withEntity(table.getEntityReference());
    String response =
        admin
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, "/v1/dataContracts", MAPPER.writeValueAsString(request));
    return MAPPER.readValue(response, DataContract.class);
  }

  private static OpenMetadataClient createTeamDomainOnlyUser(
      OpenMetadataClient admin, String prefix, Domain domain, Deque<Runnable> cleanup) {
    Role dataConsumer = admin.roles().getByName("DataConsumer");
    Role domainOnly = admin.roles().getByName("DomainOnlyAccessRole");
    Team team =
        admin
            .teams()
            .create(
                new CreateTeam()
                    .withName(prefix + "_team")
                    .withTeamType(CreateTeam.TeamType.GROUP)
                    .withDomains(List.of(domain.getFullyQualifiedName()))
                    .withDefaultRoles(List.of(dataConsumer.getId(), domainOnly.getId())));
    cleanup.push(
        () ->
            admin
                .teams()
                .delete(
                    team.getId().toString(), Map.of("hardDelete", "true", "recursive", "true")));
    String userName = prefix + "_user";
    String email = userName + "@test.openmetadata.org";
    User user =
        admin
            .users()
            .create(
                new CreateUser()
                    .withName(userName)
                    .withEmail(email)
                    .withTeams(List.of(team.getId())));
    cleanup.push(() -> admin.users().delete(user.getId().toString(), Map.of("hardDelete", "true")));
    return SdkClients.createClient(email, email, new String[] {});
  }

  private static OpenMetadataClient createUserWithDenyCondition(
      OpenMetadataClient admin, String prefix, String condition, Deque<Runnable> cleanup) {
    Policy policy =
        admin
            .policies()
            .create(
                new CreatePolicy()
                    .withName(prefix + "_policy")
                    .withDescription("Deny dataContract by domain condition")
                    .withRules(
                        List.of(
                            new Rule()
                                .withName("deny_dc_domain")
                                .withResources(List.of(Entity.DATA_CONTRACT))
                                .withOperations(List.of(MetadataOperation.ALL))
                                .withEffect(Rule.Effect.DENY)
                                .withCondition(condition))));
    cleanup.push(
        () -> admin.policies().delete(policy.getId().toString(), Map.of("hardDelete", "true")));
    Role role =
        admin
            .roles()
            .create(
                new CreateRole()
                    .withName(prefix + "_role")
                    .withDescription("Deny dataContract role")
                    .withPolicies(List.of(policy.getFullyQualifiedName())));
    cleanup.push(() -> admin.roles().delete(role.getId().toString(), Map.of("hardDelete", "true")));
    String email = prefix + "@test.openmetadata.org";
    User user =
        admin
            .users()
            .create(
                new CreateUser()
                    .withName(prefix)
                    .withEmail(email)
                    .withRoles(List.of(role.getId())));
    cleanup.push(() -> admin.users().delete(user.getId().toString(), Map.of("hardDelete", "true")));
    return SdkClients.createClient(email, email, new String[] {});
  }

  private static void replaceDomains(
      OpenMetadataClient admin, String entityPath, List<Domain> domains) throws Exception {
    List<EntityReference> refs = domains.stream().map(Domain::getEntityReference).toList();
    String patch =
        MAPPER.writeValueAsString(
            List.of(Map.of("op", "replace", "path", "/domains", "value", refs)));
    patchJson(admin, entityPath, patch);
  }

  private static void patchJson(OpenMetadataClient admin, String path, String jsonPatch) {
    admin.getHttpClient().executeForString(HttpMethod.PATCH, path, jsonPatch, JSON_PATCH);
  }

  private static void enableSearchAccessControl(OpenMetadataClient admin, Deque<Runnable> cleanup)
      throws Exception {
    boolean original = setSearchAccessControl(admin, true);
    cleanup.push(
        () -> {
          try {
            setSearchAccessControl(admin, original);
          } catch (Exception ignored) {
            // Best-effort restore.
          }
        });
  }

  private static boolean setSearchAccessControl(OpenMetadataClient admin, boolean enabled)
      throws Exception {
    String settingsJson =
        admin
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/settings/" + SettingsType.SEARCH_SETTINGS.value(),
                null);
    Settings settings = MAPPER.readValue(settingsJson, Settings.class);
    SearchSettings search = MAPPER.convertValue(settings.getConfigValue(), SearchSettings.class);
    boolean original = Boolean.TRUE.equals(search.getGlobalSettings().getEnableAccessControl());
    if (original != enabled) {
      search.getGlobalSettings().setEnableAccessControl(enabled);
      admin
          .getHttpClient()
          .executeForString(
              HttpMethod.PUT,
              "/v1/system/settings",
              MAPPER.writeValueAsString(
                  new Settings()
                      .withConfigType(SettingsType.SEARCH_SETTINGS)
                      .withConfigValue(search)));
    }
    return original;
  }

  private static void assumeTheServerTrustsHarnessSignedTokens() {
    Assumptions.assumeTrue(
        !OssTestServer.isExternalMode(),
        "Signs test user tokens with the harness key, which a deployed cluster rejects");
  }

  private static void drain(Deque<Runnable> cleanup) {
    while (!cleanup.isEmpty()) {
      try {
        cleanup.pop().run();
      } catch (Exception ignored) {
        // Best-effort teardown; namespaces isolate concurrent tests regardless.
      }
    }
  }
}
