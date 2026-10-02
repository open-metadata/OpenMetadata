package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.api.tests.CreateTestDefinition;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.tests.TestPlatform;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.TestDefinitionEntityType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.service.resources.dqtests.TestDefinitionResource;

/**
 * Integration tests for TestDefinition entity operations.
 *
 * <p>Extends BaseEntityIT to inherit common entity tests. Adds test definition-specific tests.
 *
 * <p>Migrated from: org.openmetadata.service.resources.dqtests.TestDefinitionResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
public class TestDefinitionResourceIT extends BaseEntityIT<TestDefinition, CreateTestDefinition> {

  private static final List<String> ENTITY_TYPE_CASINGS =
      List.of("COLUMN", "Column", "column", " Column ");
  private static final List<String> BLANK_ENTITY_TYPES = List.of("", " ");
  private static final int ENTITY_TYPE_FILTER_LIMIT = 1000000;
  private static final int SORT_FIXTURE_COUNT = 3;
  private static final List<String> NUMERIC_AGGREGATE_DEFINITIONS =
      List.of(
          "columnValueMaxToBeBetween",
          "columnValueMeanToBeBetween",
          "columnValueMedianToBeBetween",
          "columnValueMinToBeBetween",
          "columnValueStdDevToBeBetween",
          "columnValuesSumToBeBetween");
  private static final String REGEX_DEFINITION = "columnValuesToMatchRegex";

  // Disable tests that don't apply to TestDefinition
  {
    supportsFollowers = false; // TestDefinition doesn't support followers
    supportsTags = false; // TestDefinition tags are handled differently
    supportsDataProducts = false; // TestDefinition doesn't support dataProducts
    supportsNameLengthValidation = false; // TestDefinition doesn't enforce name length
    supportsSearchIndex = false; // TestDefinition doesn't have a search index
    supportsListHistoryByTimestamp = true;
  }

  @Override
  protected String getResourcePath() {
    return TestDefinitionResource.COLLECTION_PATH;
  }

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateTestDefinition createMinimalRequest(TestNamespace ns) {
    CreateTestDefinition request = new CreateTestDefinition();
    request.setName(ns.prefix("testdefinition"));
    request.setDescription("Test definition created by integration test");
    request.setEntityType(TestDefinitionEntityType.TABLE);
    request.setTestPlatforms(List.of(TestPlatform.OPEN_METADATA));

    return request;
  }

  @Override
  protected CreateTestDefinition createRequest(String name, TestNamespace ns) {
    CreateTestDefinition request = new CreateTestDefinition();
    request.setName(name);
    request.setDescription("Test definition");
    request.setEntityType(TestDefinitionEntityType.TABLE);
    request.setTestPlatforms(List.of(TestPlatform.OPEN_METADATA));

    return request;
  }

  @Override
  protected TestDefinition createEntity(CreateTestDefinition createRequest) {
    return SdkClients.adminClient().testDefinitions().create(createRequest);
  }

  @Override
  protected TestDefinition getEntity(String id) {
    return SdkClients.adminClient().testDefinitions().get(id);
  }

  @Override
  protected TestDefinition getEntityByName(String fqn) {
    return SdkClients.adminClient().testDefinitions().getByName(fqn);
  }

  @Override
  protected TestDefinition patchEntity(String id, TestDefinition entity) {
    return SdkClients.adminClient().testDefinitions().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().testDefinitions().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().testDefinitions().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    SdkClients.adminClient().testDefinitions().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "testDefinition";
  }

  @Override
  protected void validateCreatedEntity(TestDefinition entity, CreateTestDefinition createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertEquals(createRequest.getEntityType(), entity.getEntityType());

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }

    assertTrue(
        entity.getFullyQualifiedName().contains(entity.getName()),
        "FQN should contain test definition name");
  }

  @Override
  protected ListResponse<TestDefinition> listEntities(ListParams params) {
    return SdkClients.adminClient().testDefinitions().list(params);
  }

  @Override
  protected TestDefinition getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().testDefinitions().get(id, fields);
  }

  @Override
  protected TestDefinition getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().testDefinitions().getByName(fqn, fields);
  }

  @Override
  protected TestDefinition getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().testDefinitions().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().testDefinitions().getVersionList(id);
  }

  @Override
  protected TestDefinition getVersion(UUID id, Double version) {
    return SdkClients.adminClient().testDefinitions().getVersion(id.toString(), version);
  }

  // ===================================================================
  // TEST DEFINITION-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_testDefinitionForTable_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTestDefinition request = new CreateTestDefinition();
    request.setName(ns.prefix("testdef_table"));
    request.setDescription("Table test definition");
    request.setEntityType(TestDefinitionEntityType.TABLE);
    request.setTestPlatforms(List.of(TestPlatform.OPEN_METADATA));

    TestDefinition testDefinition = createEntity(request);
    assertNotNull(testDefinition);
    assertEquals(TestDefinitionEntityType.TABLE, testDefinition.getEntityType());
  }

  @Test
  void post_testDefinitionForColumn_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTestDefinition request = new CreateTestDefinition();
    request.setName(ns.prefix("testdef_column"));
    request.setDescription("Column test definition");
    request.setEntityType(TestDefinitionEntityType.COLUMN);
    request.setTestPlatforms(List.of(TestPlatform.OPEN_METADATA));

    TestDefinition testDefinition = createEntity(request);
    assertNotNull(testDefinition);
    assertEquals(TestDefinitionEntityType.COLUMN, testDefinition.getEntityType());
  }

  @Test
  void post_testDefinitionWithMultiplePlatforms_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTestDefinition request = new CreateTestDefinition();
    request.setName(ns.prefix("testdef_multi_platform"));
    request.setDescription("Multi-platform test definition");
    request.setEntityType(TestDefinitionEntityType.TABLE);
    request.setTestPlatforms(Arrays.asList(TestPlatform.OPEN_METADATA, TestPlatform.DBT));

    TestDefinition testDefinition = createEntity(request);
    assertNotNull(testDefinition);
    assertEquals(2, testDefinition.getTestPlatforms().size());
  }

  @Test
  void put_testDefinitionDescription_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTestDefinition request = new CreateTestDefinition();
    request.setName(ns.prefix("testdef_update_desc"));
    request.setDescription("Initial description");
    request.setEntityType(TestDefinitionEntityType.TABLE);
    request.setTestPlatforms(List.of(TestPlatform.OPEN_METADATA));

    TestDefinition testDefinition = createEntity(request);
    assertEquals("Initial description", testDefinition.getDescription());

    // Update description
    testDefinition.setDescription("Updated description");
    TestDefinition updated = patchEntity(testDefinition.getId().toString(), testDefinition);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void test_testDefinitionNameUniqueness(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create first test definition
    String name = ns.prefix("unique_testdef");
    CreateTestDefinition request1 = new CreateTestDefinition();
    request1.setName(name);
    request1.setDescription("First test definition");
    request1.setEntityType(TestDefinitionEntityType.TABLE);
    request1.setTestPlatforms(List.of(TestPlatform.OPEN_METADATA));

    TestDefinition testDefinition1 = createEntity(request1);
    assertNotNull(testDefinition1);

    // Attempt to create duplicate
    CreateTestDefinition request2 = new CreateTestDefinition();
    request2.setName(name);
    request2.setDescription("Duplicate test definition");
    request2.setEntityType(TestDefinitionEntityType.TABLE);
    request2.setTestPlatforms(List.of(TestPlatform.OPEN_METADATA));

    assertThrows(
        Exception.class,
        () -> createEntity(request2),
        "Creating duplicate test definition should fail");
  }

  // ===================================================================
  // ENTITY TYPE FILTER — issue #29542
  // ===================================================================

  @Test
  void list_entityTypeFilterIsCaseInsensitive_200_OK(TestNamespace ns) {
    TestDefinition columnDefinition = createColumnTestDefinition(ns, "casing_column");
    TestDefinition tableDefinition = createTableTestDefinition(ns, "casing_table");

    for (String casing : ENTITY_TYPE_CASINGS) {
      assertColumnOnlyListing(SdkClients.adminClient(), casing, columnDefinition, tableDefinition);
    }
  }

  @Test
  void list_entityTypeFilterRejectsUnknownEntityType_400() {
    InvalidRequestException exception =
        assertThrows(
            InvalidRequestException.class,
            () -> listByEntityType(SdkClients.adminClient(), "Banana"));

    assertEquals(400, exception.getStatusCode());
    assertTrue(
        exception.getMessage().contains("Banana"),
        "Error message must name the rejected value, was: " + exception.getMessage());
  }

  @Test
  void list_emptyEntityTypeFilterIsIgnored_200_OK(TestNamespace ns) {
    TestDefinition columnDefinition = createColumnTestDefinition(ns, "empty_column");
    TestDefinition tableDefinition = createTableTestDefinition(ns, "empty_table");

    for (String blank : BLANK_ENTITY_TYPES) {
      Set<String> fullyQualifiedNames =
          fullyQualifiedNamesOf(listByEntityType(SdkClients.adminClient(), blank).getData());

      assertTrue(
          fullyQualifiedNames.contains(columnDefinition.getFullyQualifiedName()),
          "A blank entityType must not filter out COLUMN test definitions");
      assertTrue(
          fullyQualifiedNames.contains(tableDefinition.getFullyQualifiedName()),
          "A blank entityType must not filter out TABLE test definitions");
    }
  }

  /**
   * Proves that a caller holding no roles at all sees exactly what an admin sees, which is what the
   * issue disputed. It does not cover the one configuration that genuinely does diverge: a
   * {@code DomainOnlyAccessRole} holder with no domains, whose listing is broken by
   * {@code EntityUtil.addDomainQueryParam} overwriting this very query param with the resource type.
   * That is a separate defect, unrelated to casing, and is not fixed or exercised here.
   */
  @Test
  void list_entityTypeFilterYieldsSameResultForAdminAndRoleLessUser_200_OK(TestNamespace ns) {
    TestDefinition columnDefinition = createColumnTestDefinition(ns, "rbac_column");
    TestDefinition tableDefinition = createTableTestDefinition(ns, "rbac_table");

    OpenMetadataClient nonAdminClient = createNonAdminClient(ns);

    for (String casing : ENTITY_TYPE_CASINGS) {
      assertColumnOnlyListing(SdkClients.adminClient(), casing, columnDefinition, tableDefinition);
      assertColumnOnlyListing(nonAdminClient, casing, columnDefinition, tableDefinition);
    }
  }

  // ===================================================================
  // SUPPORTED DATA TYPE FILTER — issue #27718
  // ===================================================================

  /**
   * A test definition that lists no supported data types declares no restriction, so it is generic
   * and must be offered for every column type. Before the fix the filter required a positive match,
   * which hid such definitions from the dropdown that maps a test case to a column.
   */
  @Test
  void list_supportedDataTypeFilterKeepsDefinitionsWithoutDataTypes_200_OK(TestNamespace ns) {
    TestDefinition generic = createColumnTestDefinition(ns, "sdt_generic");
    TestDefinition numeric =
        createColumnTestDefinitionWithDataTypes(ns, "sdt_numeric", List.of(ColumnDataType.NUMBER));

    ListResponse<TestDefinition> response =
        listBySupportedDataType(SdkClients.adminClient(), ColumnDataType.VARCHAR.value());
    Set<String> fullyQualifiedNames = fullyQualifiedNamesOf(response.getData());

    assertTrue(
        fullyQualifiedNames.contains(generic.getFullyQualifiedName()),
        "A test definition without supportedDataTypes must be returned for any data type");
    assertFalse(
        fullyQualifiedNames.contains(numeric.getFullyQualifiedName()),
        "A test definition restricted to NUMBER must not be returned for VARCHAR");
    assertTrue(
        response.getPaging().getTotal() > 0,
        "supportedDataType must produce a non-zero paging total, which is served by the DAO's"
            + " separate listCount query");
  }

  /**
   * NUMERIC is what BigQuery, Postgres, Snowflake and DB2 numeric columns are ingested as, but the
   * seeded aggregate definitions only ever listed NUMBER and DECIMAL. Since the listing filters on
   * the column's exact data type, none of mean/min/max/median/stddev/sum could be picked for a
   * NUMERIC column.
   */
  @Test
  void list_supportedDataTypeNumericReturnsSeededAggregateDefinitions_200_OK() {
    Set<String> fullyQualifiedNames =
        fullyQualifiedNamesOf(
            listBySupportedDataType(SdkClients.adminClient(), ColumnDataType.NUMERIC.value())
                .getData());

    assertTrue(
        fullyQualifiedNames.containsAll(NUMERIC_AGGREGATE_DEFINITIONS),
        () ->
            "Every seeded numeric aggregate definition must be offered for a NUMERIC column, missing: "
                + NUMERIC_AGGREGATE_DEFINITIONS.stream()
                    .filter(name -> !fullyQualifiedNames.contains(name))
                    .collect(Collectors.joining(", ")));
    assertFalse(
        fullyQualifiedNames.contains(REGEX_DEFINITION),
        REGEX_DEFINITION
            + " only supports string types, so returning it for NUMERIC would mean the filter"
            + " stopped discriminating rather than that the data types were corrected");
  }

  private static ListResponse<TestDefinition> listBySupportedDataType(
      OpenMetadataClient client, String supportedDataType) {
    ListParams params =
        new ListParams()
            .setLimit(ENTITY_TYPE_FILTER_LIMIT)
            .addFilter("supportedDataType", supportedDataType);

    return client.testDefinitions().list(params);
  }

  private OpenMetadataClient createNonAdminClient(TestNamespace ns) {
    String name = ns.shortPrefix("etfilter");
    String email = name + "@test.openmetadata.org";
    SdkClients.adminClient().users().create(new CreateUser().withName(name).withEmail(email));

    return SdkClients.createClient(email, email, new String[] {});
  }

  /**
   * Asserts the filtered listing by set membership rather than by set equality: test definitions are
   * a global collection and this class runs with {@link ExecutionMode#CONCURRENT}, so a sibling test
   * can add or remove one between two list calls. Membership of definitions this test owns is stable
   * and still distinguishes a working filter from one that silently returns nothing.
   */
  private void assertColumnOnlyListing(
      OpenMetadataClient client,
      String entityTypeParam,
      TestDefinition columnDefinition,
      TestDefinition tableDefinition) {
    ListResponse<TestDefinition> response = listByEntityType(client, entityTypeParam);
    List<TestDefinition> definitions = response.getData();
    Set<String> fullyQualifiedNames = fullyQualifiedNamesOf(definitions);

    assertTrue(
        definitions.stream().allMatch(d -> d.getEntityType() == TestDefinitionEntityType.COLUMN),
        "entityType=" + entityTypeParam + " must return only COLUMN test definitions");
    assertTrue(
        response.getPaging().getTotal() > 0,
        "entityType="
            + entityTypeParam
            + " must produce a non-zero paging total, which is served by the DAO's separate"
            + " listCount query");
    assertTrue(
        fullyQualifiedNames.contains(columnDefinition.getFullyQualifiedName()),
        "entityType="
            + entityTypeParam
            + " must return the COLUMN test definition "
            + columnDefinition.getFullyQualifiedName());
    assertFalse(
        fullyQualifiedNames.contains(tableDefinition.getFullyQualifiedName()),
        "entityType="
            + entityTypeParam
            + " must not return the TABLE test definition "
            + tableDefinition.getFullyQualifiedName());
  }

  /**
   * The listing is sorted server-side across the whole table, so these tests isolate their own
   * rows with the {@code q} search on the namespace prefix rather than asserting absolute
   * positions among the seeded system definitions.
   */
  @Test
  void list_sortsByDisplayNameAscendingByDefault_200_OK(TestNamespace ns) {
    String marker = createSortFixtures(ns, "sortasc");

    assertEquals(
        List.of("Alpha rule", "Mike rule", "Zulu rule"),
        displayNamesOf(listSorted(marker, null, null)),
        "An unspecified sortField must keep the display-name ascending order");
  }

  @Test
  void list_sortsByDisplayNameDescending_200_OK(TestNamespace ns) {
    String marker = createSortFixtures(ns, "sortdesc");

    assertEquals(
        List.of("Zulu rule", "Mike rule", "Alpha rule"),
        displayNamesOf(listSorted(marker, "displayName", "desc")),
        "sortOrder=desc must reverse the display-name order");
  }

  @Test
  void list_sortsByEntityType_200_OK(TestNamespace ns) {
    String marker = createSortFixtures(ns, "sortentity");

    List<TestDefinitionEntityType> ascending =
        entityTypesOf(listSorted(marker, "entityType", null));
    List<TestDefinitionEntityType> descending =
        entityTypesOf(listSorted(marker, "entityType", "desc"));

    assertEquals(
        List.of(
            TestDefinitionEntityType.COLUMN,
            TestDefinitionEntityType.TABLE,
            TestDefinitionEntityType.TABLE),
        ascending,
        "sortField=entityType must group COLUMN before TABLE");
    assertEquals(
        List.of(
            TestDefinitionEntityType.TABLE,
            TestDefinitionEntityType.TABLE,
            TestDefinitionEntityType.COLUMN),
        descending,
        "sortField=entityType with sortOrder=desc must group TABLE first");
  }

  @Test
  void list_sortsByTestPlatforms_200_OK(TestNamespace ns) {
    String marker = createSortFixtures(ns, "sortplatform");

    assertEquals(
        List.of("Mike rule", "Zulu rule", "Alpha rule"),
        displayNamesOf(listSorted(marker, "testPlatforms", null)),
        "sortField=testPlatforms must order on the first platform each rule declares: "
            + "dbt, then OpenMetadata, then Soda");
    assertEquals(
        List.of("Alpha rule", "Zulu rule", "Mike rule"),
        displayNamesOf(listSorted(marker, "testPlatforms", "desc")),
        "sortField=testPlatforms with sortOrder=desc must reverse that order");
  }

  /**
   * The keyset cursor is built from the active sort key, so a page boundary is where a mismatch
   * between the SQL ordering and the Java-side cursor shows up — rows repeat or vanish. Walking
   * every ordering one row at a time is the only assertion that catches it.
   */
  @Test
  void list_pagesAcrossBoundariesInEverySortOrder_200_OK(TestNamespace ns) {
    String marker = createSortFixtures(ns, "sortpaging");

    for (String sortField : Arrays.asList(null, "displayName", "entityType", "testPlatforms")) {
      for (String sortOrder : Arrays.asList(null, "asc", "desc")) {
        String ordering = "sortField=" + sortField + " sortOrder=" + sortOrder;
        List<String> singlePage =
            fullyQualifiedNamesInOrder(listSorted(marker, sortField, sortOrder));
        List<String> paged = pageThrough(marker, sortField, sortOrder);

        // Without this the comparison below passes on two empty lists, which is
        // exactly how a descending listing that returns nothing slips through.
        assertEquals(
            SORT_FIXTURE_COUNT,
            singlePage.size(),
            "Every ordering must return all the fixtures, missing for " + ordering);
        assertEquals(
            singlePage,
            paged,
            "Paging one row at a time must reproduce the single-page order for " + ordering);
      }
    }
  }

  /**
   * The first page has no cursor, and {@code EntityRepository} seeds it with an empty cursor name.
   * That is an ascending-only sentinel — {@code key > ''} admits every row but {@code key < ''}
   * admits none — so a descending listing that did not drop the keyset predicate for an
   * unanchored page came back empty.
   */
  @Test
  void list_returnsAFirstPageWithNoCursorInEitherDirection_200_OK(TestNamespace ns) {
    String marker = createSortFixtures(ns, "sortfirstpage");

    for (String sortOrder : Arrays.asList("asc", "desc")) {
      ListParams params =
          sortParams(marker, "displayName", sortOrder).setLimit(SORT_FIXTURE_COUNT - 1);

      assertEquals(
          SORT_FIXTURE_COUNT - 1,
          SdkClients.adminClient().testDefinitions().list(params).getData().size(),
          "An uncursored first page must be full for sortOrder=" + sortOrder);
    }
  }

  @Test
  void list_rejectsUnknownSortField_400() {
    InvalidRequestException exception =
        assertThrows(InvalidRequestException.class, () -> listSorted("anything", "banana", null));

    assertEquals(400, exception.getStatusCode());
    assertTrue(
        exception.getMessage().contains("banana") && exception.getMessage().contains("displayName"),
        "Error must name the rejected value and the allowed ones, was: " + exception.getMessage());
  }

  @Test
  void list_rejectsUnknownSortOrder_400() {
    InvalidRequestException exception =
        assertThrows(
            InvalidRequestException.class, () -> listSorted("anything", "displayName", "sideways"));

    assertEquals(400, exception.getStatusCode());
    assertTrue(
        exception.getMessage().contains("sideways"),
        "Error must name the rejected value, was: " + exception.getMessage());
  }

  /**
   * Three definitions whose display names sort differently from their internal names, so an
   * ordering that silently fell back to the {@code name} column would fail rather than pass by
   * coincidence. Every sortable column holds a distinct value per fixture: rows that
   * tie on the sort key fall back to a random UUID, so an assertion over a tied pair passes or
   * fails by chance. Returns the marker every fixture name embeds, for the {@code q} search to
   * isolate them.
   */
  private String createSortFixtures(TestNamespace ns, String marker) {
    String scopedMarker = ns.prefix(marker);
    createSortFixture(
        scopedMarker,
        "zzz",
        "Alpha rule",
        TestDefinitionEntityType.COLUMN,
        List.of(TestPlatform.SODA));
    createSortFixture(
        scopedMarker,
        "aaa",
        "Zulu rule",
        TestDefinitionEntityType.TABLE,
        List.of(TestPlatform.OPEN_METADATA));
    createSortFixture(
        scopedMarker,
        "mmm",
        "Mike rule",
        TestDefinitionEntityType.TABLE,
        List.of(TestPlatform.DBT));

    return scopedMarker;
  }

  private void createSortFixture(
      String scopedMarker,
      String nameSuffix,
      String displayName,
      TestDefinitionEntityType entityType,
      List<TestPlatform> platforms) {
    CreateTestDefinition request = new CreateTestDefinition();
    request.setName(scopedMarker + "_" + nameSuffix);
    request.setDisplayName(displayName);
    request.setDescription("Test definition for sort ordering");
    request.setEntityType(entityType);
    request.setTestPlatforms(platforms);

    createEntity(request);
  }

  private static ListResponse<TestDefinition> listSorted(
      String marker, String sortField, String sortOrder) {
    return SdkClients.adminClient()
        .testDefinitions()
        .list(sortParams(marker, sortField, sortOrder));
  }

  private static ListParams sortParams(String marker, String sortField, String sortOrder) {
    ListParams params = new ListParams().setLimit(ENTITY_TYPE_FILTER_LIMIT).addFilter("q", marker);
    if (sortField != null) {
      params.addFilter("sortField", sortField);
    }
    if (sortOrder != null) {
      params.addFilter("sortOrder", sortOrder);
    }

    return params;
  }

  private static List<String> pageThrough(String marker, String sortField, String sortOrder) {
    List<String> fullyQualifiedNames = new ArrayList<>();
    String after = null;
    do {
      ListParams params = sortParams(marker, sortField, sortOrder).setLimit(1).setAfter(after);
      ListResponse<TestDefinition> page = SdkClients.adminClient().testDefinitions().list(params);
      fullyQualifiedNames.addAll(fullyQualifiedNamesInOrder(page));
      after = page.getPaging() == null ? null : page.getPaging().getAfter();
    } while (after != null);

    return fullyQualifiedNames;
  }

  private static List<String> displayNamesOf(ListResponse<TestDefinition> response) {
    return response.getData().stream().map(TestDefinition::getDisplayName).toList();
  }

  private static List<TestDefinitionEntityType> entityTypesOf(
      ListResponse<TestDefinition> response) {
    return response.getData().stream().map(TestDefinition::getEntityType).toList();
  }

  private static List<String> fullyQualifiedNamesInOrder(ListResponse<TestDefinition> response) {
    return response.getData().stream().map(TestDefinition::getFullyQualifiedName).toList();
  }

  private static ListResponse<TestDefinition> listByEntityType(
      OpenMetadataClient client, String entityTypeParam) {
    ListParams params =
        new ListParams()
            .setLimit(ENTITY_TYPE_FILTER_LIMIT)
            .addFilter("entityType", entityTypeParam);

    return client.testDefinitions().list(params);
  }

  private static Set<String> fullyQualifiedNamesOf(List<TestDefinition> definitions) {
    return definitions.stream()
        .map(TestDefinition::getFullyQualifiedName)
        .collect(Collectors.toSet());
  }

  private TestDefinition createColumnTestDefinition(TestNamespace ns, String name) {
    return createTestDefinition(ns, name, TestDefinitionEntityType.COLUMN);
  }

  private TestDefinition createTableTestDefinition(TestNamespace ns, String name) {
    return createTestDefinition(ns, name, TestDefinitionEntityType.TABLE);
  }

  private TestDefinition createColumnTestDefinitionWithDataTypes(
      TestNamespace ns, String name, List<ColumnDataType> supportedDataTypes) {
    CreateTestDefinition request = new CreateTestDefinition();
    request.setName(ns.prefix(name));
    request.setDescription("Test definition for supportedDataType filtering");
    request.setEntityType(TestDefinitionEntityType.COLUMN);
    request.setTestPlatforms(List.of(TestPlatform.OPEN_METADATA));
    request.setSupportedDataTypes(supportedDataTypes);

    return createEntity(request);
  }

  private TestDefinition createTestDefinition(
      TestNamespace ns, String name, TestDefinitionEntityType entityType) {
    CreateTestDefinition request = new CreateTestDefinition();
    request.setName(ns.prefix(name));
    request.setDescription("Test definition for entityType filtering");
    request.setEntityType(entityType);
    request.setTestPlatforms(List.of(TestPlatform.OPEN_METADATA));

    return createEntity(request);
  }
}
