package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.ws.rs.core.Response;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.function.Executable;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.factories.GlossaryTermTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.factories.ShortStackFactory;
import org.openmetadata.it.util.RdfTestUtils;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.alert.type.EmailAlertConfig;
import org.openmetadata.schema.api.data.CreateDashboard;
import org.openmetadata.schema.api.data.CreateMetric;
import org.openmetadata.schema.api.data.CreateMetricGroup;
import org.openmetadata.schema.api.data.MetricDimension;
import org.openmetadata.schema.api.data.MetricExpression;
import org.openmetadata.schema.api.data.MetricMeasure;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.tasks.ResolveTask;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.api.tests.CreateTestCaseResult;
import org.openmetadata.schema.api.tests.CreateTestDefinition;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.MetricGroup;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.tests.TestPlatform;
import org.openmetadata.schema.tests.type.Severity;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.DataQualityDimensions;
import org.openmetadata.schema.type.Edge;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityLineage;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.MetricExpressionLanguage;
import org.openmetadata.schema.type.MetricGranularity;
import org.openmetadata.schema.type.MetricType;
import org.openmetadata.schema.type.MetricUnitOfMeasurement;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.type.TestDefinitionEntityType;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;

/**
 * Integration tests for Metric entity operations.
 *
 * <p>Extends BaseEntityIT to inherit common entity tests. Adds metric-specific tests for metric
 * expressions, granularity, and related metrics.
 *
 * <p>Migrated from: org.openmetadata.service.resources.metrics.MetricResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
public class MetricResourceIT extends BaseEntityIT<Metric, CreateMetric> {
  private static final String METRIC_CSV_HEADER =
      "name*,displayName,description,metricType,unitOfMeasurement,customUnitOfMeasurement,"
          + "granularity,expressionLanguage,expressionCode,relatedMetrics,tags,glossaryTerms,"
          + "tiers,owners,reviewers,domains,dataProducts,entityStatus,extension,parent,experts,"
          + "metricGroup";

  private static final String HIERARCHY_FIELDS = "parent,children,childrenCount";
  private static final String RESTRICTED_TAG_FQN = "PII.Sensitive";

  private static final ObjectMapper JSON = new ObjectMapper();

  {
    supportsListHistoryByTimestamp = true;
    supportsBulkAPI = true;
  }

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateMetric createMinimalRequest(TestNamespace ns) {
    return new CreateMetric()
        .withName(ns.prefix("metric"))
        .withDescription("Test metric created by integration test");
  }

  @Override
  protected CreateMetric createRequest(String name, TestNamespace ns) {
    return new CreateMetric().withName(name).withDescription("Test metric");
  }

  @Override
  protected Metric createEntity(CreateMetric createRequest) {
    return SdkClients.adminClient().metrics().create(createRequest);
  }

  @Override
  protected Metric getEntity(String id) {
    return SdkClients.adminClient().metrics().get(id);
  }

  @Override
  protected Metric getEntityByName(String fqn) {
    return SdkClients.adminClient().metrics().getByName(fqn);
  }

  @Override
  protected Metric patchEntity(String id, Metric entity) {
    return SdkClients.adminClient().metrics().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().metrics().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().metrics().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    Map<String, String> params = new HashMap<>();
    params.put("hardDelete", "true");
    SdkClients.adminClient().metrics().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "metric";
  }

  @Override
  protected void validateCreatedEntity(Metric entity, CreateMetric createRequest) {
    assertEquals(createRequest.getName(), entity.getName());

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }

    assertTrue(
        entity.getFullyQualifiedName().contains(entity.getName()),
        "FQN should contain metric name");
  }

  @Override
  protected ListResponse<Metric> listEntities(ListParams params) {
    return SdkClients.adminClient().metrics().list(params);
  }

  @Override
  protected Metric getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().metrics().get(id, fields);
  }

  @Override
  protected Metric getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().metrics().getByName(fqn, fields);
  }

  @Override
  protected Metric getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().metrics().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().metrics().getVersionList(id);
  }

  @Override
  protected Metric getVersion(UUID id, Double version) {
    return SdkClients.adminClient().metrics().getVersion(id.toString(), version);
  }

  @Test
  void metricExpertsPersistUpdateAppearInHierarchyAndRequireEditPermission(TestNamespace ns) {
    SharedEntities shared = SharedEntities.get();
    Metric created =
        createEntity(
            createRequest(ns.prefix("metric_experts"), ns)
                .withExperts(List.of(shared.USER1_REF.getFullyQualifiedName())));

    Metric fetched = getEntityWithFields(created.getId().toString(), "experts");
    assertEquals(1, fetched.getExperts().size());
    assertEquals(shared.USER1_REF.getId(), fetched.getExperts().getFirst().getId());

    fetched.setExperts(List.of(shared.USER2_REF));
    Metric updated = patchEntity(fetched.getId().toString(), fetched);
    assertEquals(shared.USER2_REF.getId(), updated.getExperts().getFirst().getId());
    assertEquals(
        shared.USER2_REF.getId(),
        getEntityWithFields(created.getId().toString(), "experts").getExperts().getFirst().getId());

    JsonNode hierarchy =
        JSON.valueToTree(
            SdkClients.adminClient()
                .getHttpClient()
                .execute(
                    HttpMethod.GET,
                    "/v1/metrics/hierarchy?q=" + created.getName(),
                    null,
                    Object.class));
    assertEquals(
        shared.USER2_REF.getId().toString(),
        hierarchy.get("data").get(0).get("metric").get("experts").get(0).get("id").asText());

    Metric forbidden =
        SdkClients.user2Client().metrics().get(created.getId().toString(), "experts");
    forbidden.setExperts(List.of(shared.USER1_REF));
    assertApiStatus(
        403,
        () -> SdkClients.user2Client().metrics().update(created.getId().toString(), forbidden));
  }

  @Test
  void test_metricGlossaryTermRdfLink(TestNamespace ns) {
    assumeTrue(
        TestSuiteBootstrap.isFusekiEnabled(),
        "Skipping RDF test: Fuseki not enabled (run with -DenableRdf=true)");
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm term = GlossaryTermTestFactory.createWithName(ns, glossary, "metricConcept");

    Metric metric = createEntity(createRequest(ns.prefix("metricGlossary"), ns));

    TagLabel glossaryTag =
        new TagLabel()
            .withTagFQN(term.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.GLOSSARY)
            .withLabelType(TagLabel.LabelType.MANUAL)
            .withState(TagLabel.State.CONFIRMED);

    metric.setTags(List.of(glossaryTag));
    Metric updatedMetric = patchEntity(metric.getId().toString(), metric);

    String metricUri = "https://open-metadata.org/entity/metric/" + updatedMetric.getId();
    String termUri = "https://open-metadata.org/entity/glossaryTerm/" + term.getId();

    String sparql =
        String.format(
            "PREFIX om: <https://open-metadata.org/ontology/> "
                + "ASK { "
                + "  GRAPH ?g { "
                + "    <%s> om:hasGlossaryTerm <%s> . "
                + "  } "
                + "}",
            metricUri, termUri);

    Awaitility.await()
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(() -> assertTrue(RdfTestUtils.executeSparqlAsk(sparql)));
  }

  // ===================================================================
  // METRIC-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_metricWithExpression_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateMetric request =
        new CreateMetric()
            .withName(ns.prefix("metric_expr"))
            .withDescription("Metric with expression")
            .withMetricExpression(
                new MetricExpression()
                    .withCode("sum(revenue)")
                    .withLanguage(MetricExpressionLanguage.SQL));

    Metric metric = createEntity(request);
    assertNotNull(metric);
    assertNotNull(metric.getMetricExpression());
    assertEquals("sum(revenue)", metric.getMetricExpression().getCode());
    assertEquals(MetricExpressionLanguage.SQL, metric.getMetricExpression().getLanguage());
  }

  @Test
  void put_metricCsvImportExport_200_OK(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    SharedEntities shared = SharedEntities.get();
    MetricGroup group =
        client
            .getHttpClient()
            .execute(
                HttpMethod.PUT,
                "/v1/metricGroups",
                new CreateMetricGroup().withName(ns.prefix("metric_csv_group")),
                MetricGroup.class);
    String metricName = ns.prefix("metric_csv");
    String secondMetricName = ns.prefix("metric_csv_second");
    String header = METRIC_CSV_HEADER;
    String row =
        String.join(
            ",",
            metricName,
            "CSV Metric",
            "Metric imported from CSV",
            "OTHER",
            "DOLLARS",
            "",
            "DAY",
            "SQL",
            "SUM(sales.amount)",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "Approved",
            "",
            "",
            shared.USER1_REF.getFullyQualifiedName(),
            group.getFullyQualifiedName());
    String secondRow =
        String.join(
            ",",
            secondMetricName,
            "Second CSV Metric",
            "Second metric imported from CSV",
            "SUM",
            "DOLLARS",
            "",
            "DAY",
            "SQL",
            "SUM(sales.net_amount)",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "Approved",
            "",
            "",
            "",
            "");
    String csv = header + "\n" + row + "\n" + secondRow + "\n";

    CsvImportResult result =
        new ObjectMapper()
            .readValue(client.metrics().importCsv("*", csv, false), CsvImportResult.class);
    assertEquals(2, result.getNumberOfRowsPassed(), result.getImportResultsCsv());

    Metric imported = getEntityByNameWithFields(metricName, "experts,metricGroup");
    assertEquals(shared.USER1_REF.getId(), imported.getExperts().getFirst().getId());
    assertEquals(group.getId(), imported.getMetricGroup().getId());
    assertNotNull(imported);
    assertEquals(MetricExpressionLanguage.SQL, imported.getMetricExpression().getLanguage());
    Metric secondImported = getEntityByName(secondMetricName);
    assertNotNull(secondImported);
    assertEquals(MetricExpressionLanguage.SQL, secondImported.getMetricExpression().getLanguage());

    String exportedCsv = client.metrics().exportCsv("*");
    assertTrue(exportedCsv.contains(metricName));
    assertTrue(exportedCsv.contains(secondMetricName));
    assertTrue(exportedCsv.contains("expressionCode"));
    assertTrue(exportedCsv.contains("tiers"));
  }

  @Test
  void post_metricWithGranularity_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateMetric request =
        new CreateMetric()
            .withName(ns.prefix("metric_gran"))
            .withDescription("Metric with granularity")
            .withGranularity(MetricGranularity.DAY)
            .withMetricType(MetricType.COUNT);

    Metric metric = createEntity(request);
    assertNotNull(metric);
    assertEquals(MetricGranularity.DAY, metric.getGranularity());
    assertEquals(MetricType.COUNT, metric.getMetricType());
  }

  @Test
  void post_metricWithUnitOfMeasurement_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateMetric request =
        new CreateMetric()
            .withName(ns.prefix("metric_uom"))
            .withDescription("Metric with unit of measurement")
            .withUnitOfMeasurement(MetricUnitOfMeasurement.DOLLARS)
            .withMetricType(MetricType.SUM);

    Metric metric = createEntity(request);
    assertNotNull(metric);
    assertEquals(MetricUnitOfMeasurement.DOLLARS, metric.getUnitOfMeasurement());
  }

  @Test
  void post_metricWithCustomUnit_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateMetric request =
        new CreateMetric()
            .withName(ns.prefix("metric_custom_unit"))
            .withDescription("Metric with custom unit")
            .withMetricType(MetricType.COUNT)
            .withUnitOfMeasurement(MetricUnitOfMeasurement.OTHER)
            .withCustomUnitOfMeasurement("EURO");

    Metric metric = createEntity(request);
    assertNotNull(metric);
    assertEquals(MetricUnitOfMeasurement.OTHER, metric.getUnitOfMeasurement());
    assertEquals("EURO", metric.getCustomUnitOfMeasurement());
  }

  @Test
  void post_metricWithMissingCustomUnit_400(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // When UnitOfMeasurement is OTHER, customUnitOfMeasurement is required
    CreateMetric request =
        new CreateMetric()
            .withName(ns.prefix("metric_missing_custom"))
            .withDescription("Metric missing custom unit")
            .withMetricType(MetricType.COUNT)
            .withUnitOfMeasurement(MetricUnitOfMeasurement.OTHER);

    assertThrows(
        Exception.class,
        () -> createEntity(request),
        "Creating metric with OTHER unit but no custom unit should fail");
  }

  @Test
  void put_metricDescription_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateMetric request =
        new CreateMetric()
            .withName(ns.prefix("metric_update_desc"))
            .withDescription("Initial description");

    Metric metric = createEntity(request);
    assertEquals("Initial description", metric.getDescription());

    // Update description
    metric.setDescription("Updated description");
    Metric updated = patchEntity(metric.getId().toString(), metric);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void patch_metricType_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateMetric request =
        new CreateMetric()
            .withName(ns.prefix("metric_patch_type"))
            .withDescription("Metric for type patching")
            .withMetricType(MetricType.COUNT);

    Metric metric = createEntity(request);
    assertEquals(MetricType.COUNT, metric.getMetricType());

    // Update metric type
    metric.setMetricType(MetricType.SUM);
    Metric updated = patchEntity(metric.getId().toString(), metric);
    assertEquals(MetricType.SUM, updated.getMetricType());
  }

  @Test
  void test_metricRelatedMetrics(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create first metric
    CreateMetric request1 =
        new CreateMetric()
            .withName(ns.prefix("metric_related_1"))
            .withDescription("First related metric");

    Metric metric1 = createEntity(request1);
    assertNotNull(metric1);

    // Create second metric
    CreateMetric request2 =
        new CreateMetric()
            .withName(ns.prefix("metric_related_2"))
            .withDescription("Second related metric");

    Metric metric2 = createEntity(request2);
    assertNotNull(metric2);

    // Update metric2 to have metric1 as related metric
    metric2.setRelatedMetrics(List.of(metric1.getEntityReference()));
    Metric updated = patchEntity(metric2.getId().toString(), metric2);

    // Verify relationship
    Metric fetched = getEntityWithFields(updated.getId().toString(), "relatedMetrics");
    assertNotNull(fetched.getRelatedMetrics());
    assertEquals(1, fetched.getRelatedMetrics().size());
    assertEquals(metric1.getId(), fetched.getRelatedMetrics().get(0).getId());
  }

  @Test
  void test_metricCannotRelateToItself(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateMetric request =
        new CreateMetric()
            .withName(ns.prefix("metric_self_ref"))
            .withDescription("Self-referencing metric test");

    Metric metric = createEntity(request);
    assertNotNull(metric);

    // Try to set the metric as its own related metric
    metric.setRelatedMetrics(List.of(metric.getEntityReference()));

    assertThrows(
        Exception.class,
        () -> patchEntity(metric.getId().toString(), metric),
        "Metric should not be able to reference itself as related");
  }

  @Test
  void test_metricNameUniqueness(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create first metric
    String metricName = ns.prefix("unique_metric");
    CreateMetric request1 = new CreateMetric().withName(metricName).withDescription("First metric");

    Metric metric1 = createEntity(request1);
    assertNotNull(metric1);

    // Attempt to create duplicate
    CreateMetric request2 =
        new CreateMetric().withName(metricName).withDescription("Duplicate metric");

    assertThrows(
        Exception.class, () -> createEntity(request2), "Creating duplicate metric should fail");
  }

  @Test
  void test_metricWithAllAttributes(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateMetric request =
        new CreateMetric()
            .withName(ns.prefix("metric_full"))
            .withDescription("Fully configured metric")
            .withMetricType(MetricType.AVERAGE)
            .withGranularity(MetricGranularity.HOUR)
            .withUnitOfMeasurement(MetricUnitOfMeasurement.PERCENTAGE)
            .withMetricExpression(
                new MetricExpression()
                    .withCode("AVG(response_time)")
                    .withLanguage(MetricExpressionLanguage.SQL));

    Metric metric = createEntity(request);
    assertNotNull(metric);
    assertEquals(MetricType.AVERAGE, metric.getMetricType());
    assertEquals(MetricGranularity.HOUR, metric.getGranularity());
    assertEquals(MetricUnitOfMeasurement.PERCENTAGE, metric.getUnitOfMeasurement());
    assertNotNull(metric.getMetricExpression());
    assertEquals("AVG(response_time)", metric.getMetricExpression().getCode());
  }

  @Test
  void test_duplicateRelatedMetricsIssue(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateMetric createMetric1 =
        new CreateMetric()
            .withName(ns.prefix("metric_duplicate_1"))
            .withDescription("First metric for duplicate test");
    Metric metric1 = createEntity(createMetric1);

    CreateMetric createMetric2 =
        new CreateMetric()
            .withName(ns.prefix("metric_duplicate_2"))
            .withDescription("Second metric for duplicate test");
    Metric metric2 = createEntity(createMetric2);

    Metric originalMetric2 = getEntityWithFields(metric2.getId().toString(), "*");

    originalMetric2.setRelatedMetrics(List.of(metric1.getEntityReference()));
    Metric updatedMetric2 = patchEntity(metric2.getId().toString(), originalMetric2);

    Metric fetchedMetric2 = getEntityWithFields(metric2.getId().toString(), "relatedMetrics");

    assertNotNull(fetchedMetric2.getRelatedMetrics());
    assertEquals(
        1,
        fetchedMetric2.getRelatedMetrics().size(),
        "Expected only 1 related metric, but found "
            + fetchedMetric2.getRelatedMetrics().size()
            + ". Related metrics: "
            + fetchedMetric2.getRelatedMetrics());
    assertEquals(metric1.getId(), fetchedMetric2.getRelatedMetrics().get(0).getId());

    Metric fetchedMetric1 = getEntityWithFields(metric1.getId().toString(), "relatedMetrics");
    assertNotNull(fetchedMetric1.getRelatedMetrics());
    assertEquals(
        1,
        fetchedMetric1.getRelatedMetrics().size(),
        "Expected only 1 related metric for the reverse relationship, but found "
            + fetchedMetric1.getRelatedMetrics().size());
    assertEquals(metric2.getId(), fetchedMetric1.getRelatedMetrics().get(0).getId());
  }

  @Test
  void test_createMetricWithLongCustomUnit(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    String longUnit =
        "Very Long Custom Unit Name That Could Be Used In Real World Scenarios Like Monthly Active Users Excluding Internal Test Accounts And Bots From Analytics Dashboard";
    CreateMetric createMetric =
        new CreateMetric()
            .withName(ns.prefix("metric_long_custom_unit"))
            .withDescription("Metric with long custom unit")
            .withMetricType(MetricType.COUNT)
            .withUnitOfMeasurement(MetricUnitOfMeasurement.OTHER)
            .withCustomUnitOfMeasurement(longUnit);

    Metric metric = createEntity(createMetric);
    assertEquals(longUnit, metric.getCustomUnitOfMeasurement());
  }

  @Test
  void test_createMetricWithSpecialCharacters(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateMetric createMetric =
        new CreateMetric()
            .withName(ns.prefix("metric_special_custom_unit"))
            .withDescription("Metric with special characters in custom unit")
            .withMetricType(MetricType.COUNT)
            .withUnitOfMeasurement(MetricUnitOfMeasurement.OTHER)
            .withCustomUnitOfMeasurement("Special@#$%^&*()Characters用户数");

    Metric metric = createEntity(createMetric);
    assertEquals("Special@#$%^&*()Characters用户数", metric.getCustomUnitOfMeasurement());
  }

  @Test
  void test_updateMetricCustomUnit(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateMetric createMetric =
        new CreateMetric()
            .withName(ns.prefix("metric_update_custom_unit"))
            .withDescription("Metric for custom unit update test")
            .withMetricType(MetricType.COUNT)
            .withUnitOfMeasurement(MetricUnitOfMeasurement.COUNT);

    Metric originalMetric = createEntity(createMetric);
    assertNull(originalMetric.getCustomUnitOfMeasurement());

    originalMetric.setUnitOfMeasurement(MetricUnitOfMeasurement.OTHER);
    originalMetric.setCustomUnitOfMeasurement("EURO");

    Metric updatedMetric = patchEntity(originalMetric.getId().toString(), originalMetric);

    assertEquals(MetricUnitOfMeasurement.OTHER, updatedMetric.getUnitOfMeasurement());
    assertEquals("EURO", updatedMetric.getCustomUnitOfMeasurement());
  }

  @Test
  void test_customUnitClearedWhenNotOther(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateMetric createMetric =
        new CreateMetric()
            .withName(ns.prefix("metric_clear_custom_unit"))
            .withDescription("Metric for testing custom unit clearing")
            .withMetricType(MetricType.COUNT)
            .withUnitOfMeasurement(MetricUnitOfMeasurement.OTHER)
            .withCustomUnitOfMeasurement("EURO");

    Metric originalMetric = createEntity(createMetric);
    assertEquals("EURO", originalMetric.getCustomUnitOfMeasurement());

    originalMetric.setUnitOfMeasurement(MetricUnitOfMeasurement.DOLLARS);
    originalMetric.setCustomUnitOfMeasurement(null);

    Metric updatedMetric = patchEntity(originalMetric.getId().toString(), originalMetric);

    assertEquals(MetricUnitOfMeasurement.DOLLARS, updatedMetric.getUnitOfMeasurement());
    assertNull(updatedMetric.getCustomUnitOfMeasurement());
  }

  @Test
  void test_getCustomUnitsAPI(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String[] customUnits = {"EURO", "Minutes", "GB/sec", "EURO"};

    for (int i = 0; i < customUnits.length; i++) {
      CreateMetric createMetric =
          new CreateMetric()
              .withName(ns.prefix("metric_custom_units_api_" + i))
              .withDescription("Metric for custom units API test")
              .withMetricType(MetricType.COUNT)
              .withUnitOfMeasurement(MetricUnitOfMeasurement.OTHER)
              .withCustomUnitOfMeasurement(customUnits[i]);
      createEntity(createMetric);
    }

    List<String> customUnitsList =
        client.getHttpClient().execute(HttpMethod.GET, "/v1/metrics/customUnits", null, List.class);

    assertNotNull(customUnitsList);
    assertTrue(customUnitsList.contains("EURO"));
    assertTrue(customUnitsList.contains("Minutes"));
    assertTrue(customUnitsList.contains("GB/sec"));

    long euroCount = customUnitsList.stream().filter("EURO"::equals).count();
    assertEquals(1, euroCount, "EURO should appear only once in the distinct list");
  }

  @Test
  void getCustomUnitsRequiresMetricViewPermission(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    String suffix = ns.uniqueShortId();
    Rule denyMetricView =
        new Rule()
            .withName("DenyMetricView")
            .withResources(List.of(Entity.METRIC))
            .withOperations(List.of(MetadataOperation.VIEW_BASIC))
            .withEffect(Rule.Effect.DENY);
    Policy policy =
        admin
            .policies()
            .create(
                new CreatePolicy()
                    .withName("metricCustomUnitPolicy_" + suffix)
                    .withRules(List.of(denyMetricView)));
    try {
      Role role =
          admin
              .roles()
              .create(
                  new CreateRole()
                      .withName("metricCustomUnitRole_" + suffix)
                      .withPolicies(List.of(policy.getFullyQualifiedName())));
      try {
        String email = "metric-custom-unit-" + suffix + "@test.openmetadata.org";
        User user =
            admin
                .users()
                .create(
                    new CreateUser()
                        .withName("metric-custom-unit-" + suffix)
                        .withEmail(email)
                        .withRoles(List.of(role.getId())));
        try {
          OpenMetadataClient restricted = SdkClients.createClient(email, email, new String[] {});

          assertApiStatus(
              Response.Status.FORBIDDEN.getStatusCode(),
              () ->
                  restricted
                      .getHttpClient()
                      .execute(HttpMethod.GET, "/v1/metrics/customUnits", null, List.class));
        } finally {
          admin.users().delete(user.getId());
        }
      } finally {
        admin.roles().delete(role.getId());
      }
    } finally {
      admin.policies().delete(policy.getId());
    }
  }

  @Test
  void test_customUnitTrimming(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateMetric createMetric =
        new CreateMetric()
            .withName(ns.prefix("metric_trim_custom_unit"))
            .withDescription("Metric for testing custom unit trimming")
            .withMetricType(MetricType.COUNT)
            .withUnitOfMeasurement(MetricUnitOfMeasurement.OTHER)
            .withCustomUnitOfMeasurement("  EURO  ");

    Metric metric = createEntity(createMetric);
    assertEquals("EURO", metric.getCustomUnitOfMeasurement());
  }

  @Test
  void test_reviewersUpdateAndPatch(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    SharedEntities shared = SharedEntities.get();

    CreateMetric createMetric =
        new CreateMetric()
            .withName(ns.prefix("metric_reviewers"))
            .withDescription("Metric for reviewers test");
    Metric metric = createEntity(createMetric);

    assertTrue(
        metric.getReviewers() == null || metric.getReviewers().isEmpty(),
        "Metric should have no reviewers initially");

    Metric updatedMetric = patchMetricReviewers(metric.getId(), List.of(shared.USER1_REF));

    assertNotNull(updatedMetric.getReviewers(), "Metric should have reviewers after update");
    assertEquals(1, updatedMetric.getReviewers().size(), "Metric should have one reviewer");
    assertEquals(
        shared.USER1_REF.getId(),
        updatedMetric.getReviewers().get(0).getId(),
        "Reviewer should match USER1");

    Metric retrievedMetric = getEntityWithFields(updatedMetric.getId().toString(), "reviewers");
    assertNotNull(retrievedMetric.getReviewers(), "Retrieved metric should have reviewers");
    assertEquals(
        1, retrievedMetric.getReviewers().size(), "Retrieved metric should have one reviewer");
    assertEquals(
        shared.USER1_REF.getId(),
        retrievedMetric.getReviewers().get(0).getId(),
        "Retrieved reviewer should match USER1");

    updatedMetric = patchMetricReviewers(updatedMetric.getId(), List.of(shared.USER2_REF));

    assertEquals(1, updatedMetric.getReviewers().size(), "Metric should still have one reviewer");
    assertEquals(
        shared.USER2_REF.getId(),
        updatedMetric.getReviewers().get(0).getId(),
        "Reviewer should now be USER2");

    updatedMetric =
        patchMetricReviewers(updatedMetric.getId(), List.of(shared.USER2_REF, shared.USER1_REF));

    assertEquals(2, updatedMetric.getReviewers().size(), "Metric should have two reviewers");
    assertTrue(
        updatedMetric.getReviewers().stream()
            .anyMatch(r -> r.getId().equals(shared.USER1_REF.getId())),
        "Should contain USER1 as reviewer");
    assertTrue(
        updatedMetric.getReviewers().stream()
            .anyMatch(r -> r.getId().equals(shared.USER2_REF.getId())),
        "Should contain USER2 as reviewer");
  }

  private Metric patchMetricReviewers(UUID metricId, List<EntityReference> reviewers) {
    JsonNode patch =
        JSON.createArrayNode()
            .add(
                JSON.createObjectNode()
                    .put("op", "add")
                    .put("path", "/reviewers")
                    .set("value", JSON.valueToTree(reviewers)));
    SdkClients.adminClient().metrics().patch(metricId, patch);
    return getEntityWithFields(metricId.toString(), "reviewers");
  }

  @Test
  @Override
  void test_entityStatus(TestNamespace ns) {
    CreateMetric createMetric =
        new CreateMetric()
            .withName(ns.prefix("metric_entity_status"))
            .withDescription("Metric for entity status test");
    Metric metric = createEntity(createMetric);

    assertEquals(
        EntityStatus.APPROVED,
        metric.getEntityStatus(),
        "A Metric without reviewers should be created Approved");

    metric.setEntityStatus(EntityStatus.IN_REVIEW);
    Metric updatedMetric = patchEntity(metric.getId().toString(), metric);

    assertEquals(
        EntityStatus.IN_REVIEW,
        updatedMetric.getEntityStatus(),
        "Metric should be updated to IN_REVIEW status");

    Metric retrievedMetric = getEntity(updatedMetric.getId().toString());
    assertEquals(
        EntityStatus.IN_REVIEW,
        retrievedMetric.getEntityStatus(),
        "Retrieved metric should maintain IN_REVIEW status");

    updatedMetric.setEntityStatus(EntityStatus.DEPRECATED);
    updatedMetric = patchEntity(updatedMetric.getId().toString(), updatedMetric);

    assertEquals(
        EntityStatus.DEPRECATED,
        updatedMetric.getEntityStatus(),
        "Metric should be updated to DEPRECATED status");
  }

  // ===================================================================
  // SEARCH TESTS
  // ===================================================================

  @Test
  void test_searchMetricWithLongName_doesNotCauseClauseExplosion(TestNamespace ns)
      throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    ObjectMapper objectMapper = new ObjectMapper();

    CreateMetric request =
        new CreateMetric()
            .withName(ns.prefix("AcceleratedConnection_WBA_Ethernet_ServiceLevel"))
            .withDescription("Metric with a long multi-word name to test search clause explosion");

    Metric metric = createEntity(request);
    assertNotNull(metric);

    Awaitility.await("Wait for metric to appear in search index")
        .pollDelay(Duration.ofMillis(500))
        .pollInterval(Duration.ofSeconds(2))
        .atMost(Duration.ofSeconds(90))
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              String searchResponse = searchForEntity(metric.getId().toString());
              assertNotNull(searchResponse);
              assertTrue(searchResponse.contains(metric.getId().toString()));
            });

    String searchQuery = "AcceleratedConnection WBA Ethernet ServiceLevel";
    assertDoesNotThrow(
        () -> {
          String response =
              client.search().query(searchQuery).index("metric_search_index").size(10).execute();
          assertNotNull(response);
          JsonNode root = objectMapper.readTree(response);
          assertFalse(
              root.has("error") && root.get("error").asText().contains("too_many_nested_clauses"),
              "Search should not fail with too_many_nested_clauses error");
          assertTrue(root.has("hits"), "Response should have hits");
        },
        "Searching for a metric with a long multi-word name should not cause clause explosion");
  }

  // ===================================================================
  // HIERARCHY
  // ===================================================================

  private Metric createChild(TestNamespace ns, String name, Metric parent) {
    return createEntity(
        new CreateMetric()
            .withName(ns.prefix(name))
            .withDescription("Child metric")
            .withParent(parent.getFullyQualifiedName()));
  }

  private Metric getWithHierarchy(Metric metric) {
    return getEntityWithFields(metric.getId().toString(), HIERARCHY_FIELDS);
  }

  private ListResponse<Metric> listByParent(String parent) {
    return listEntities(
        new ListParams().setParent(parent).setFields(HIERARCHY_FIELDS).setLimit(1000));
  }

  private static boolean containsMetric(ListResponse<Metric> response, Metric metric) {
    return response.getData().stream().anyMatch(m -> m.getId().equals(metric.getId()));
  }

  @Test
  void post_metricWithParent_establishesHierarchy(TestNamespace ns) {
    Metric parent = createEntity(createRequest(ns.prefix("hier_parent"), ns));
    Metric child = createChild(ns, "hier_child", parent);

    assertNotNull(child.getParent(), "Child should carry its parent reference on create");
    assertEquals(parent.getId(), child.getParent().getId());

    Metric fetchedChild = getWithHierarchy(child);
    assertEquals(parent.getId(), fetchedChild.getParent().getId());
    assertEquals(0, fetchedChild.getChildrenCount());

    Metric fetchedParent = getWithHierarchy(parent);
    assertNull(fetchedParent.getParent(), "Root metric should have no parent");
    assertEquals(1, fetchedParent.getChildrenCount());
    assertEquals(1, fetchedParent.getChildren().size());
    assertEquals(child.getId(), fetchedParent.getChildren().get(0).getId());
  }

  @Test
  void hierarchyWritesRequireEditPermissionOnParentAndGroupDestinations(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Metric source = createEntity(createRequest(ns.prefix("destination_source"), ns));
    Metric sourceChild = createChild(ns, "destination_source_child", source);
    Metric restrictedParent =
        createEntity(
            createRequest(ns.prefix("destination_parent"), ns)
                .withTags(List.of(new TagLabel().withTagFQN(RESTRICTED_TAG_FQN))));
    MetricGroup restrictedGroup =
        admin
            .getHttpClient()
            .execute(
                HttpMethod.POST,
                "/v1/metricGroups",
                new CreateMetricGroup()
                    .withName(ns.prefix("destination_group"))
                    .withTags(List.of(new TagLabel().withTagFQN(RESTRICTED_TAG_FQN)))
                    .withMetrics(List.of(restrictedParent.getFullyQualifiedName())),
                MetricGroup.class);
    String unauthorizedPostName = ns.prefix("destination_post");
    String unauthorizedPutName = ns.prefix("destination_put");

    withRestrictedHierarchyDestinationEditor(
        ns,
        editor -> {
          assertApiStatus(
              403,
              () ->
                  editor
                      .metrics()
                      .create(
                          createRequest(unauthorizedPostName, ns)
                              .withParent(restrictedParent.getFullyQualifiedName())));
          assertApiStatus(
              403,
              () ->
                  editor
                      .getHttpClient()
                      .execute(
                          HttpMethod.PUT,
                          "/v1/metrics",
                          createRequest(unauthorizedPutName, ns)
                              .withMetricGroup(restrictedGroup.getFullyQualifiedName()),
                          Metric.class));

          Metric parentPatch =
              editor.metrics().get(source.getId().toString(), "parent,metricGroup");
          parentPatch.setParent(restrictedParent.getEntityReference());
          assertApiStatus(
              403, () -> editor.metrics().update(source.getId().toString(), parentPatch));

          Metric groupPatch = editor.metrics().get(source.getId().toString(), "parent,metricGroup");
          groupPatch.setMetricGroup(restrictedGroup.getEntityReference());
          assertApiStatus(
              403, () -> editor.metrics().update(source.getId().toString(), groupPatch));

          JsonNode directParentPatch =
              JSON.createArrayNode()
                  .add(
                      JSON.createObjectNode()
                          .put("op", "add")
                          .put("path", "/parent")
                          .set("value", JSON.valueToTree(restrictedParent.getEntityReference())));
          assertApiStatus(403, () -> editor.metrics().patch(source.getId(), directParentPatch));
          assertNull(admin.metrics().get(source.getId().toString(), "parent").getParent());

          JsonNode directGroupPatch =
              JSON.createArrayNode()
                  .add(
                      JSON.createObjectNode()
                          .put("op", "add")
                          .put("path", "/metricGroup")
                          .set("value", JSON.valueToTree(restrictedGroup.getEntityReference())));
          assertApiStatus(403, () -> editor.metrics().patch(source.getId(), directGroupPatch));
          assertNull(
              admin.metrics().get(source.getId().toString(), "metricGroup").getMetricGroup());

          assertApiStatus(
              403,
              () ->
                  editor
                      .getHttpClient()
                      .execute(
                          HttpMethod.PUT,
                          "/v1/metrics",
                          createRequest(source.getName(), ns)
                              .withParent(restrictedParent.getFullyQualifiedName()),
                          Metric.class));
          assertApiStatus(
              403,
              () ->
                  editor
                      .getHttpClient()
                      .execute(
                          HttpMethod.PUT,
                          "/v1/metrics",
                          createRequest(source.getName(), ns)
                              .withMetricGroup(restrictedGroup.getFullyQualifiedName()),
                          Metric.class));
        });

    assertApiStatus(404, () -> admin.metrics().getByName(unauthorizedPostName));
    assertApiStatus(404, () -> admin.metrics().getByName(unauthorizedPutName));
    Metric unchanged = admin.metrics().get(source.getId().toString(), "parent,metricGroup");
    Metric unchangedChild =
        admin.metrics().get(sourceChild.getId().toString(), "parent,metricGroup");
    assertNull(unchanged.getParent());
    assertNull(unchanged.getMetricGroup());
    assertEquals(source.getId(), unchangedChild.getParent().getId());
    assertNull(unchangedChild.getMetricGroup());
  }

  @Test
  void post_metricParentedToItself_400(TestNamespace ns) {
    String name = ns.prefix("hier_self");
    Exception error =
        assertThrows(
            Exception.class,
            () ->
                createEntity(
                    new CreateMetric()
                        .withName(name)
                        .withDescription("Self-parented metric")
                        .withParent(name)));
    assertTrue(error.getMessage().contains("cannot be its own parent"));
  }

  @Test
  void patch_metricDirectCycle_400(TestNamespace ns) {
    Metric parent = createEntity(createRequest(ns.prefix("cycle_a"), ns));
    Metric child = createChild(ns, "cycle_b", parent);

    // parent already CONTAINS child, so making child the parent's parent closes a 2-node cycle
    Metric reparented = getWithHierarchy(parent);
    reparented.setParent(child.getEntityReference());
    Exception error =
        assertThrows(Exception.class, () -> patchEntity(reparented.getId().toString(), reparented));
    assertTrue(error.getMessage().contains("Circular reference detected"));
  }

  @Test
  void patch_metricTransitiveCycle_400(TestNamespace ns) {
    Metric grandParent = createEntity(createRequest(ns.prefix("cycle_gp"), ns));
    Metric parent = createChild(ns, "cycle_p", grandParent);
    Metric child = createChild(ns, "cycle_c", parent);

    // grandParent -> parent -> child; pointing grandParent at child closes a 3-node cycle
    Metric reparented = getWithHierarchy(grandParent);
    reparented.setParent(child.getEntityReference());
    Exception error =
        assertThrows(Exception.class, () -> patchEntity(reparented.getId().toString(), reparented));
    assertTrue(error.getMessage().contains("Circular reference detected"));
  }

  @Test
  void patch_metricReparent_movesEdgeAndKeepsFqn(TestNamespace ns) {
    Metric oldParent = createEntity(createRequest(ns.prefix("move_old"), ns));
    Metric newParent = createEntity(createRequest(ns.prefix("move_new"), ns));
    Metric child = createChild(ns, "move_child", oldParent);
    String originalFqn = child.getFullyQualifiedName();

    Metric toMove = getWithHierarchy(child);
    toMove.setParent(newParent.getEntityReference());
    Metric moved = patchEntity(toMove.getId().toString(), toMove);

    assertEquals(
        originalFqn,
        moved.getFullyQualifiedName(),
        "Reparenting must not rewrite the metric's fully qualified name");
    assertEquals(newParent.getId(), moved.getParent().getId());
    assertEquals(0, getWithHierarchy(oldParent).getChildrenCount());
    assertEquals(1, getWithHierarchy(newParent).getChildrenCount());
  }

  @Test
  void patch_metricClearParent_makesItRoot(TestNamespace ns) {
    Metric parent = createEntity(createRequest(ns.prefix("clear_parent"), ns));
    Metric child = createChild(ns, "clear_child", parent);

    Metric toDetach = getWithHierarchy(child);
    toDetach.setParent(null);
    Metric detached = patchEntity(toDetach.getId().toString(), toDetach);

    assertNull(detached.getParent(), "Clearing parent should make the metric a root");
    assertEquals(0, getWithHierarchy(parent).getChildrenCount());
    assertTrue(containsMetric(listByParent("null"), detached));
  }

  @Test
  void patch_metricChildrenAreReadOnly(TestNamespace ns) {
    Metric parent = createEntity(createRequest(ns.prefix("frozen_parent"), ns));
    Metric child = createChild(ns, "frozen_child", parent);
    Metric other = createEntity(createRequest(ns.prefix("frozen_other"), ns));

    JsonNode patch =
        JSON.createArrayNode()
            .add(
                JSON.createObjectNode()
                    .put("op", "add")
                    .put("path", "/children")
                    .set("value", JSON.valueToTree(List.of(other.getEntityReference()))));
    assertApiStatus(400, () -> SdkClients.adminClient().metrics().patch(parent.getId(), patch));

    Metric refetched = getWithHierarchy(parent);
    assertEquals(1, refetched.getChildrenCount(), "childrenCount must stay derived from edges");
    assertEquals(1, refetched.getChildren().size());
    assertEquals(
        child.getId(),
        refetched.getChildren().get(0).getId(),
        "Patching children must not rewire the hierarchy");
  }

  @Test
  void delete_metricWithChildren_400_thenRecursiveSucceeds(TestNamespace ns) {
    Metric parent = createEntity(createRequest(ns.prefix("del_parent"), ns));
    createChild(ns, "del_child", parent);

    assertThrows(
        Exception.class,
        () -> deleteEntity(parent.getId().toString()),
        "Deleting a metric that still has children must fail without recursive=true");

    Map<String, String> params = new HashMap<>();
    params.put("recursive", "true");
    params.put("hardDelete", "true");
    assertDoesNotThrow(
        () -> SdkClients.adminClient().metrics().delete(parent.getId().toString(), params));
  }

  @Test
  void get_softDeletedChildExcludedFromChildrenCount(TestNamespace ns) {
    Metric parent = createEntity(createRequest(ns.prefix("soft_parent"), ns));
    Metric child = createChild(ns, "soft_child", parent);
    assertEquals(1, getWithHierarchy(parent).getChildrenCount());

    deleteEntity(child.getId().toString());

    assertEquals(
        0, getWithHierarchy(parent).getChildrenCount(), "A soft-deleted child must not be counted");
  }

  @Test
  void list_parentNull_returnsRootsOnly(TestNamespace ns) {
    Metric parent = createEntity(createRequest(ns.prefix("roots_parent"), ns));
    Metric child = createChild(ns, "roots_child", parent);

    ListResponse<Metric> roots = listByParent("null");
    assertTrue(containsMetric(roots, parent), "A metric with no parent is a root");
    assertFalse(containsMetric(roots, child), "A child metric must not be listed as a root");
  }

  @Test
  void list_parentFqn_returnsImmediateChildrenOnly(TestNamespace ns) {
    Metric parent = createEntity(createRequest(ns.prefix("imm_parent"), ns));
    Metric child = createChild(ns, "imm_child", parent);
    Metric grandChild = createChild(ns, "imm_grandchild", child);

    ListResponse<Metric> children = listByParent(parent.getFullyQualifiedName());
    assertTrue(containsMetric(children, child));
    assertFalse(
        containsMetric(children, grandChild),
        "parent={fqn} must return immediate children, not the whole subtree");
    assertFalse(containsMetric(children, parent));
  }

  @Test
  void list_withoutParentParam_returnsBothRootsAndChildren(TestNamespace ns) {
    Metric parent = createEntity(createRequest(ns.prefix("flat_parent"), ns));
    Metric child = createChild(ns, "flat_child", parent);

    ListResponse<Metric> all =
        listEntities(new ListParams().setFields(HIERARCHY_FIELDS).setLimit(1000));
    assertTrue(containsMetric(all, parent), "Legacy unfiltered listing must be unchanged");
    assertTrue(containsMetric(all, child), "Legacy unfiltered listing must include children");
  }

  @Test
  void get_hierarchySearchByChildReturnsNavigableRoot(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Metric root = createEntity(createRequest(ns.prefix("search_root"), ns));
    Metric child = createChild(ns, "search_nested_variant", root);

    JsonNode response =
        JSON.valueToTree(
            client
                .getHttpClient()
                .execute(
                    HttpMethod.GET,
                    "/v1/metrics/hierarchy?q=" + child.getName() + "&limit=1&offset=0",
                    null,
                    Object.class));

    assertEquals(1, response.get("paging").get("total").asInt());
    assertEquals("metric", response.get("data").get(0).get("kind").asText());
    assertEquals(
        root.getId().toString(), response.get("data").get(0).get("metric").get("id").asText());
    assertFalse(response.get("data").get(0).has("group"));
  }

  @Test
  void get_hierarchySearchMatchesStandaloneDisplayName(TestNamespace ns) {
    Metric metric =
        createEntity(
            createRequest(ns.prefix("display_name_root"), ns)
                .withDisplayName("Friendly Conversion Metric"));

    JsonNode response =
        JSON.valueToTree(
            SdkClients.adminClient()
                .getHttpClient()
                .execute(
                    HttpMethod.GET,
                    "/v1/metrics/hierarchy?q=Conversion&limit=10&offset=0",
                    null,
                    Object.class));

    assertEquals(1, response.get("paging").get("total").asInt());
    assertEquals(
        metric.getId().toString(), response.get("data").get(0).get("metric").get("id").asText());
  }

  @Test
  void get_metricHierarchyContextPagesAncestorsSiblingsAndChildren(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Metric root = createEntity(createRequest(ns.prefix("context_root"), ns));
    Metric current = createChild(ns, "context_current", root);
    createChild(ns, "context_sibling", root);
    Metric child = createChild(ns, "context_child", current);

    JsonNode context =
        JSON.valueToTree(
            client
                .getHttpClient()
                .execute(
                    HttpMethod.GET,
                    "/v1/metrics/"
                        + current.getId()
                        + "/hierarchy?childLimit=1&childOffset=0&siblingLimit=1&siblingOffset=0",
                    null,
                    Object.class));

    assertEquals(current.getId().toString(), context.get("current").get("id").asText());
    assertEquals(root.getId().toString(), context.get("ancestors").get(0).get("id").asText());
    assertEquals(child.getId().toString(), context.get("children").get(0).get("id").asText());
    assertEquals(1, context.get("childrenPaging").get("total").asInt());
    assertEquals(1, context.get("siblingPaging").get("total").asInt());

    JsonNode childrenOnly =
        JSON.valueToTree(
            client
                .getHttpClient()
                .execute(
                    HttpMethod.GET,
                    "/v1/metrics/"
                        + current.getId()
                        + "/hierarchy?childLimit=1&childOffset=0&siblingLimit=0&siblingOffset=0",
                    null,
                    Object.class));
    assertEquals(1, childrenOnly.get("children").size());
    assertEquals(0, childrenOnly.get("siblings").size());
    assertEquals(1, childrenOnly.get("siblingPaging").get("total").asInt());

    JsonNode siblingsOnly =
        JSON.valueToTree(
            client
                .getHttpClient()
                .execute(
                    HttpMethod.GET,
                    "/v1/metrics/"
                        + current.getId()
                        + "/hierarchy?childLimit=0&childOffset=0&siblingLimit=1&siblingOffset=0",
                    null,
                    Object.class));
    assertEquals(0, siblingsOnly.get("children").size());
    assertEquals(1, siblingsOnly.get("siblings").size());
    assertEquals(1, siblingsOnly.get("childrenPaging").get("total").asInt());
  }

  @Test
  void hierarchyEndpointsFilterAndSanitizeEveryRestrictedMetricReference(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    TagLabel restrictedTag = new TagLabel().withTagFQN("PII.Sensitive");
    Metric restrictedParent =
        createEntity(
            createRequest(ns.prefix("rbac_00_restricted_parent"), ns)
                .withTags(List.of(restrictedTag)));
    Metric current = createChild(ns, "rbac_01_current", restrictedParent);
    Metric restrictedSibling =
        createEntity(
            createRequest(ns.prefix("rbac_02_restricted_sibling"), ns)
                .withParent(restrictedParent.getFullyQualifiedName())
                .withTags(List.of(restrictedTag)));
    Metric visibleSibling = createChild(ns, "rbac_03_visible_sibling", restrictedParent);
    Metric restrictedChild =
        createEntity(
            createRequest(ns.prefix("rbac_04_restricted_child"), ns)
                .withParent(current.getFullyQualifiedName())
                .withTags(List.of(restrictedTag)));
    Metric visibleChild = createChild(ns, "rbac_05_visible_child", current);
    MetricGroup visibleGroup =
        admin
            .getHttpClient()
            .execute(
                HttpMethod.PUT,
                "/v1/metricGroups",
                new CreateMetricGroup()
                    .withName(ns.prefix("rbac_visible_group"))
                    .withMetrics(List.of(restrictedParent.getFullyQualifiedName())),
                MetricGroup.class);
    Metric visibleMetricInRestrictedGroup =
        createEntity(createRequest(ns.prefix("rbac_visible_in_hidden_group"), ns));
    MetricGroup restrictedGroup =
        admin
            .getHttpClient()
            .execute(
                HttpMethod.PUT,
                "/v1/metricGroups",
                new CreateMetricGroup()
                    .withName(ns.prefix("rbac_restricted_group"))
                    .withTags(List.of(restrictedTag))
                    .withMetrics(List.of(visibleMetricInRestrictedGroup.getFullyQualifiedName())),
                MetricGroup.class);
    Metric allowedBulkRoot = createEntity(createRequest(ns.prefix("rbac_allowed_bulk_root"), ns));

    Rule allowCatalog =
        new Rule()
            .withName("AllowCatalog")
            .withResources(List.of("All"))
            .withOperations(
                List.of(
                    MetadataOperation.VIEW_BASIC,
                    MetadataOperation.VIEW_ALL,
                    MetadataOperation.EDIT_ALL))
            .withEffect(Rule.Effect.ALLOW);
    Rule denyRestricted =
        new Rule()
            .withName("DenyRestrictedMetrics")
            .withResources(List.of("metric", "metricGroup"))
            .withOperations(
                List.of(
                    MetadataOperation.VIEW_BASIC,
                    MetadataOperation.VIEW_ALL,
                    MetadataOperation.EDIT_ALL))
            .withCondition("matchAnyTag('PII.Sensitive')")
            .withEffect(Rule.Effect.DENY);
    String suffix = ns.uniqueShortId();
    Policy policy =
        admin
            .policies()
            .create(
                new CreatePolicy()
                    .withName("metricHierarchyPolicy_" + suffix)
                    .withRules(List.of(allowCatalog, denyRestricted)));
    try {
      Role role =
          admin
              .roles()
              .create(
                  new CreateRole()
                      .withName("metricHierarchyRole_" + suffix)
                      .withPolicies(List.of(policy.getFullyQualifiedName())));
      try {
        String email = "metric-hierarchy-" + suffix + "@test.openmetadata.org";
        User user =
            admin
                .users()
                .create(
                    new CreateUser()
                        .withName("metric-hierarchy-" + suffix)
                        .withEmail(email)
                        .withRoles(List.of(role.getId())));
        try {
          OpenMetadataClient restricted = SdkClients.createClient(email, email, new String[] {});
          assertApiStatus(403, () -> restricted.metrics().get(restrictedParent.getId().toString()));
          assertApiStatus(
              403,
              () ->
                  restricted
                      .getHttpClient()
                      .execute(
                          HttpMethod.GET,
                          "/v1/metrics/" + restrictedParent.getId() + "/observability",
                          null,
                          Object.class));
          assertApiStatus(
              403,
              () ->
                  restricted
                      .getHttpClient()
                      .execute(
                          HttpMethod.GET,
                          "/v1/metricGroups/" + restrictedGroup.getId(),
                          null,
                          Object.class));

          JsonNode context =
              JSON.valueToTree(
                  restricted
                      .getHttpClient()
                      .execute(
                          HttpMethod.GET,
                          "/v1/metrics/"
                              + current.getId()
                              + "/hierarchy?childLimit=10&childOffset=0&siblingLimit=10&siblingOffset=0",
                          null,
                          Object.class));
          assertEquals(0, context.get("ancestors").size());
          assertEquals(1, context.get("childrenPaging").get("total").asInt());
          assertEquals(1, context.get("current").get("childrenCount").asInt());
          assertEquals(3, context.get("group").get("metricCount").asInt());
          assertEquals(
              visibleChild.getId().toString(), context.get("children").get(0).get("id").asText());
          assertEquals(1, context.get("siblingPaging").get("total").asInt());
          assertEquals(
              visibleSibling.getId().toString(), context.get("siblings").get(0).get("id").asText());
          assertTrue(
              context.get("current").path("parent").isMissingNode()
                  || context.get("current").path("parent").isNull());
          assertRestrictedNamesAbsent(
              context, restrictedParent, restrictedSibling, restrictedChild, restrictedGroup);

          JsonNode restrictedGroupContext =
              JSON.valueToTree(
                  restricted
                      .getHttpClient()
                      .execute(
                          HttpMethod.GET,
                          "/v1/metrics/"
                              + visibleMetricInRestrictedGroup.getId()
                              + "/hierarchy?childLimit=0&siblingLimit=0",
                          null,
                          Object.class));
          assertTrue(
              restrictedGroupContext.path("group").isMissingNode()
                  || restrictedGroupContext.path("group").isNull());
          assertTrue(
              restrictedGroupContext.get("current").path("metricGroup").isMissingNode()
                  || restrictedGroupContext.get("current").path("metricGroup").isNull());
          assertRestrictedNamesAbsent(restrictedGroupContext, restrictedGroup);

          JsonNode genericGroup =
              JSON.valueToTree(
                  restricted
                      .getHttpClient()
                      .execute(
                          HttpMethod.GET,
                          "/v1/metricGroups/" + visibleGroup.getId() + "?fields=*",
                          null,
                          Object.class));
          assertTrue(
              genericGroup.path("metrics").isMissingNode()
                  || genericGroup.path("metrics").isNull());
          assertRestrictedNamesAbsent(
              genericGroup, restrictedParent, restrictedSibling, restrictedChild);
          assertApiStatus(
              400,
              () ->
                  restricted
                      .getHttpClient()
                      .execute(
                          HttpMethod.GET,
                          "/v1/metricGroups/" + visibleGroup.getId() + "?fields=metrics",
                          null,
                          Object.class));

          JsonNode members =
              JSON.valueToTree(
                  restricted
                      .getHttpClient()
                      .execute(
                          HttpMethod.GET,
                          "/v1/metricGroups/" + visibleGroup.getId() + "/metrics?limit=1&offset=0",
                          null,
                          Object.class));
          assertEquals(3, members.get("paging").get("total").asInt());
          assertEquals(current.getId().toString(), members.get("data").get(0).get("id").asText());
          assertEquals(1, members.get("data").get(0).get("childrenCount").asInt());
          assertTrue(
              members.get("data").get(0).path("parent").isMissingNode()
                  || members.get("data").get(0).path("parent").isNull());
          assertRestrictedNamesAbsent(
              members, restrictedParent, restrictedSibling, restrictedChild, restrictedGroup);

          JsonNode hiddenSearch =
              JSON.valueToTree(
                  restricted
                      .getHttpClient()
                      .execute(
                          HttpMethod.GET,
                          "/v1/metrics/hierarchy?q="
                              + restrictedSibling.getName()
                              + "&limit=10&offset=0",
                          null,
                          Object.class));
          assertEquals(0, hiddenSearch.get("paging").get("total").asInt());
          assertRestrictedNamesAbsent(
              hiddenSearch, restrictedParent, restrictedSibling, restrictedChild, restrictedGroup);

          JsonNode hiddenGroupSearch =
              JSON.valueToTree(
                  restricted
                      .getHttpClient()
                      .execute(
                          HttpMethod.GET,
                          "/v1/metrics/hierarchy?q="
                              + visibleMetricInRestrictedGroup.getName()
                              + "&limit=10&offset=0",
                          null,
                          Object.class));
          assertEquals(0, hiddenGroupSearch.get("paging").get("total").asInt());
          assertRestrictedNamesAbsent(hiddenGroupSearch, restrictedGroup);

          String hierarchyScope = current.getName().substring(current.getName().indexOf("__"));
          JsonNode visibleSecondPage =
              JSON.valueToTree(
                  restricted
                      .getHttpClient()
                      .execute(
                          HttpMethod.GET,
                          "/v1/metrics/hierarchy?q=" + hierarchyScope + "&limit=1&offset=1",
                          null,
                          Object.class));
          assertEquals(2, visibleSecondPage.get("paging").get("total").asInt());
          assertEquals(
              visibleGroup.getId().toString(),
              visibleSecondPage.get("data").get(0).get("group").get("id").asText());
          assertEquals(
              3, visibleSecondPage.get("data").get(0).get("group").get("metricCount").asInt());
          assertTrue(
              visibleSecondPage.get("data").get(0).get("group").path("metrics").isMissingNode()
                  || visibleSecondPage.get("data").get(0).get("group").path("metrics").isNull());
          assertRestrictedNamesAbsent(
              visibleSecondPage,
              restrictedParent,
              restrictedSibling,
              restrictedChild,
              restrictedGroup);

          JsonNode bulk =
              JSON.valueToTree(
                  restricted
                      .getHttpClient()
                      .execute(
                          HttpMethod.PUT,
                          "/v1/metricGroups/" + visibleGroup.getName() + "/metrics/add",
                          new BulkAssets()
                              .withAssets(
                                  List.of(
                                      restrictedParent.getEntityReference(),
                                      allowedBulkRoot.getEntityReference())),
                          Object.class));
          assertEquals(1, bulk.get("numberOfRowsPassed").asInt());
          assertEquals(1, bulk.get("numberOfRowsFailed").asInt());
          assertEquals(
              visibleGroup.getId(),
              restricted
                  .metrics()
                  .get(allowedBulkRoot.getId().toString(), "metricGroup")
                  .getMetricGroup()
                  .getId());
        } finally {
          admin.users().delete(user.getId());
        }
      } finally {
        admin.roles().delete(role.getId());
      }
    } finally {
      admin.policies().delete(policy.getId());
    }
  }

  private static void assertRestrictedNamesAbsent(JsonNode response, Object... restrictedEntities) {
    String serialized = response.toString();
    for (Object restricted : restrictedEntities) {
      if (restricted instanceof Metric metric) {
        assertFalse(serialized.contains(metric.getName()));
        assertFalse(serialized.contains(metric.getFullyQualifiedName()));
      } else if (restricted instanceof MetricGroup group) {
        assertFalse(serialized.contains(group.getName()));
        assertFalse(serialized.contains(group.getFullyQualifiedName()));
      }
    }
  }

  @Test
  void put_metricCsvRoundTripWithParent(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Metric parent = createEntity(createRequest(ns.prefix("csv_parent"), ns));
    String childName = ns.prefix("csv_child");

    String row =
        String.join(
            ",",
            childName,
            "CSV Child Metric",
            "Child imported from CSV",
            "SUM",
            "DOLLARS",
            "",
            "DAY",
            "SQL",
            "SUM(x)",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "Approved",
            "",
            parent.getFullyQualifiedName(),
            "",
            "");
    String csv = METRIC_CSV_HEADER + "\n" + row + "\n";

    CsvImportResult result =
        new ObjectMapper()
            .readValue(client.metrics().importCsv("*", csv, false), CsvImportResult.class);
    assertEquals(1, result.getNumberOfRowsPassed(), result.getImportResultsCsv());

    Metric imported = getEntityByNameWithFields(childName, HIERARCHY_FIELDS);
    assertNotNull(imported.getParent(), "Imported child should be attached to its parent");
    assertEquals(parent.getId(), imported.getParent().getId());

    String exportedCsv = client.metrics().exportCsv("*");
    assertTrue(exportedCsv.contains("parent"), "Export header should carry the parent column");
    assertTrue(exportedCsv.contains(parent.getFullyQualifiedName()));
  }

  // ===================================================================
  // APPROVAL
  // ===================================================================

  @Test
  void post_metricWithoutReviewers_isApproved(TestNamespace ns) {
    Metric metric = createEntity(createRequest(ns.prefix("approval_none"), ns));
    assertEquals(
        EntityStatus.APPROVED,
        metric.getEntityStatus(),
        "A metric with no reviewers has nothing to approve and should start Approved");
  }

  @Test
  void post_metricWithReviewersButIncompleteMetadataRemainsDraft(TestNamespace ns) {
    SharedEntities shared = SharedEntities.get();
    Metric metric =
        createEntity(
            new CreateMetric()
                .withName(ns.prefix("approval_incomplete"))
                .withReviewers(List.of(shared.USER1_REF)));

    Awaitility.await("Incomplete Metric should not enter approval review")
        .during(Duration.ofSeconds(5))
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofMillis(500))
        .untilAsserted(
            () -> {
              assertEquals(
                  EntityStatus.DRAFT, getEntity(metric.getId().toString()).getEntityStatus());
              assertTrue(listOpenApprovalTasks(metric.getFullyQualifiedName()).getData().isEmpty());
            });
  }

  @Test
  void post_metricWithReviewersCreatesApprovalTaskAndReviewerCanApprove(TestNamespace ns)
      throws Exception {
    SharedEntities shared = SharedEntities.get();
    Metric metric =
        createEntity(
            new CreateMetric()
                .withName(ns.prefix("approval_reviewed"))
                .withDescription("Metric awaiting review")
                .withReviewers(List.of(shared.USER1_REF)));

    assertEquals(EntityStatus.DRAFT, metric.getEntityStatus());

    Task task = awaitApprovalTask(metric);
    EventSubscription notification = createApprovalTaskNotification(ns);
    try {
      long processedBefore = processedNotificationEvents(notification);
      SdkClients.user1Client()
          .tasks()
          .resolve(
              task.getId().toString(),
              new ResolveTask().withResolutionType(TaskResolutionType.Approved));

      Awaitility.await("Reviewer approval should synchronize Metric status")
          .atMost(Duration.ofMinutes(2))
          .pollInterval(Duration.ofSeconds(2))
          .untilAsserted(
              () ->
                  assertEquals(
                      EntityStatus.APPROVED,
                      getEntity(metric.getId().toString()).getEntityStatus()));
      Awaitility.await("Approval task update should be delivered to its notification subscription")
          .atMost(Duration.ofMinutes(1))
          .pollInterval(Duration.ofSeconds(2))
          .untilAsserted(
              () -> assertTrue(processedNotificationEvents(notification) > processedBefore));

      Task approvedTask = SdkClients.adminClient().tasks().get(task.getId().toString());
      assertEquals(TaskEntityStatus.Approved, approvedTask.getStatus());
      EntityHistory taskHistory = SdkClients.adminClient().tasks().getVersionList(task.getId());
      EntityHistory metricHistory =
          SdkClients.adminClient().metrics().getVersionList(metric.getId());
      assertHistoryNewestFirst(taskHistory);
      assertHistoryNewestFirst(metricHistory);

      Metric reviewerUpdate =
          SdkClients.user1Client().metrics().get(metric.getId().toString(), "reviewers");
      reviewerUpdate.setDescription("Reviewer-authored approved definition");
      SdkClients.user1Client().metrics().update(metric.getId().toString(), reviewerUpdate);

      Awaitility.await("Reviewer-authored changes should auto-approve")
          .atMost(Duration.ofMinutes(2))
          .pollInterval(Duration.ofSeconds(2))
          .untilAsserted(
              () -> {
                Metric current = getEntity(metric.getId().toString());
                assertEquals(EntityStatus.APPROVED, current.getEntityStatus());
                assertEquals("Reviewer-authored approved definition", current.getDescription());
                assertTrue(
                    listOpenApprovalTasks(metric.getFullyQualifiedName()).getData().isEmpty());
              });
    } finally {
      SdkClients.adminClient().eventSubscriptions().delete(notification.getId().toString());
    }
  }

  /**
   * Metric approval is the generic RequestApproval task type (no dedicated MetricApproval type), so
   * its reject carries the same {@code requiresComment=true} UI hint Glossary does — enforced by the
   * UI, not the backend. Backend comment enforcement is DAR-only. A commentless metric reject must
   * therefore succeed and drive the metric to REJECTED. An unknown transition id still 400s
   * (transition validation is independent of comments).
   */
  @Test
  void rejectNewMetricWithoutCommentSetsRejected(TestNamespace ns) {
    SharedEntities shared = SharedEntities.get();
    Metric metric =
        createEntity(
            new CreateMetric()
                .withName(ns.prefix("approval_rejected"))
                .withDescription("Metric to reject")
                .withReviewers(List.of(shared.USER1_REF)));
    Task task = awaitApprovalTask(metric);
    EventSubscription notification = createApprovalTaskNotification(ns);

    try {
      long processedBefore = processedNotificationEvents(notification);
      assertApiStatus(
          400,
          () ->
              SdkClients.user1Client()
                  .tasks()
                  .resolve(
                      task.getId().toString(),
                      new ResolveTask()
                          .withTransitionId("unknown-reject-transition")
                          .withResolutionType(TaskResolutionType.Rejected)));
      SdkClients.user1Client()
          .tasks()
          .resolve(
              task.getId().toString(),
              new ResolveTask().withResolutionType(TaskResolutionType.Rejected));

      Awaitility.await("New Metric rejection should synchronize status and notification")
          .atMost(Duration.ofMinutes(2))
          .pollInterval(Duration.ofSeconds(2))
          .untilAsserted(
              () -> {
                assertEquals(
                    EntityStatus.REJECTED, getEntity(metric.getId().toString()).getEntityStatus());
                assertTrue(processedNotificationEvents(notification) > processedBefore);
              });
      Task rejectedTask = SdkClients.adminClient().tasks().get(task.getId().toString());
      assertEquals(TaskEntityStatus.Rejected, rejectedTask.getStatus());
      assertEquals(TaskResolutionType.Rejected, rejectedTask.getResolution().getType());
      EntityHistory taskHistory = SdkClients.adminClient().tasks().getVersionList(task.getId());
      EntityHistory metricHistory =
          SdkClients.adminClient().metrics().getVersionList(metric.getId());
      assertHistoryContains(taskHistory, "status", TaskEntityStatus.Rejected.value());
      assertHistoryContains(metricHistory, "entityStatus", EntityStatus.REJECTED.value());
    } finally {
      SdkClients.adminClient().eventSubscriptions().delete(notification.getId().toString());
    }
  }

  @Test
  void rejectMetricUpdateRollsBackPreviousApprovedVersion(TestNamespace ns) {
    SharedEntities shared = SharedEntities.get();
    String approvedDescription = "Previously approved definition";
    Metric metric =
        createEntity(
            new CreateMetric()
                .withName(ns.prefix("approval_rollback"))
                .withDescription(approvedDescription)
                .withReviewers(List.of(shared.USER1_REF)));
    Task approvalTask = awaitApprovalTask(metric);
    String approvalNote = "Approved baseline definition";

    SdkClients.user1Client()
        .tasks()
        .resolve(
            approvalTask.getId().toString(),
            new ResolveTask()
                .withResolutionType(TaskResolutionType.Approved)
                .withComment(approvalNote));

    Awaitility.await("Metric approval should complete before the update")
        .atMost(Duration.ofMinutes(2))
        .pollInterval(Duration.ofSeconds(2))
        .untilAsserted(
            () ->
                assertEquals(
                    EntityStatus.APPROVED, getEntity(metric.getId().toString()).getEntityStatus()));

    Task approvedTask = SdkClients.adminClient().tasks().get(approvalTask.getId().toString());
    assertEquals(TaskEntityStatus.Approved, approvedTask.getStatus());
    assertEquals(TaskResolutionType.Approved, approvedTask.getResolution().getType());
    assertEquals(approvalNote, approvedTask.getResolution().getComment());

    Metric update = getEntityWithFields(metric.getId().toString(), "reviewers");
    update.setDescription("Unapproved definition change");
    Metric pending = patchEntity(update.getId().toString(), update);
    Task rejectionTask = awaitApprovalTask(pending);
    String decisionNote = "Keep the approved definition";

    SdkClients.user1Client()
        .tasks()
        .resolve(
            rejectionTask.getId().toString(),
            new ResolveTask()
                .withResolutionType(TaskResolutionType.Rejected)
                .withComment(decisionNote));

    Awaitility.await("Rejected Metric update should roll back")
        .atMost(Duration.ofMinutes(2))
        .pollInterval(Duration.ofSeconds(2))
        .untilAsserted(
            () -> {
              Metric rolledBack = getEntity(metric.getId().toString());
              assertEquals(EntityStatus.APPROVED, rolledBack.getEntityStatus());
              assertEquals(approvedDescription, rolledBack.getDescription());
            });
    Task rejectedTask = SdkClients.adminClient().tasks().get(rejectionTask.getId().toString());
    assertEquals(TaskEntityStatus.Rejected, rejectedTask.getStatus());
    assertEquals(TaskResolutionType.Rejected, rejectedTask.getResolution().getType());
    assertEquals(decisionNote, rejectedTask.getResolution().getComment());

    Task preservedApprovalTask =
        SdkClients.adminClient().tasks().get(approvalTask.getId().toString());
    assertEquals(TaskEntityStatus.Approved, preservedApprovalTask.getStatus());
    assertEquals(TaskResolutionType.Approved, preservedApprovalTask.getResolution().getType());
    assertEquals(approvalNote, preservedApprovalTask.getResolution().getComment());

    List<Task> approvalHistory = listApprovalTasks(metric.getFullyQualifiedName()).getData();
    assertEquals(2, approvalHistory.size());
    Task listedApproval =
        approvalHistory.stream()
            .filter(task -> task.getId().equals(approvalTask.getId()))
            .findFirst()
            .orElseThrow();
    Task listedRejection =
        approvalHistory.stream()
            .filter(task -> task.getId().equals(rejectionTask.getId()))
            .findFirst()
            .orElseThrow();
    assertEquals(approvalNote, listedApproval.getResolution().getComment());
    assertEquals(decisionNote, listedRejection.getResolution().getComment());

    EntityHistory taskHistory =
        SdkClients.adminClient().tasks().getVersionList(rejectionTask.getId());
    EntityHistory metricHistory = SdkClients.adminClient().metrics().getVersionList(metric.getId());
    assertHistoryContains(taskHistory, "status", TaskEntityStatus.Rejected.value());
    assertHistoryContains(taskHistory, "comment", decisionNote);
    assertHistoryContains(metricHistory, "description", "Unapproved definition change");
    assertHistoryContains(metricHistory, "description", approvedDescription);
  }

  private Task awaitApprovalTask(Metric metric) {
    Awaitility.await("Metric approval workflow should create an open task")
        .atMost(Duration.ofMinutes(5))
        .pollInterval(Duration.ofSeconds(2))
        .untilAsserted(
            () -> {
              Metric current = getEntity(metric.getId().toString());
              assertEquals(EntityStatus.IN_REVIEW, current.getEntityStatus());
              assertFalse(
                  listOpenApprovalTasks(metric.getFullyQualifiedName()).getData().isEmpty());
            });
    return listOpenApprovalTasks(metric.getFullyQualifiedName()).getData().getFirst();
  }

  private ListResponse<Task> listOpenApprovalTasks(String metricFqn) {
    return SdkClients.adminClient()
        .tasks()
        .listWithFilters(
            Map.of(
                "status",
                TaskEntityStatus.Open.value(),
                "category",
                TaskCategory.Approval.value(),
                "aboutEntity",
                metricFqn,
                "fields",
                "assignees,about"));
  }

  private ListResponse<Task> listApprovalTasks(String metricFqn) {
    return SdkClients.adminClient()
        .tasks()
        .listWithFilters(
            Map.of(
                "category",
                TaskCategory.Approval.value(),
                "aboutEntity",
                metricFqn,
                "fields",
                "assignees,about,resolution"));
  }

  private EventSubscription createApprovalTaskNotification(TestNamespace ns) {
    SubscriptionDestination destination =
        new SubscriptionDestination()
            .withId(UUID.randomUUID())
            .withType(SubscriptionDestination.SubscriptionType.EMAIL)
            .withCategory(SubscriptionDestination.SubscriptionCategory.ASSIGNEES)
            .withConfig(new EmailAlertConfig());
    return SdkClients.adminClient()
        .eventSubscriptions()
        .create(
            new CreateEventSubscription()
                .withName(ns.prefix("metric_approval_notification"))
                .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
                .withResources(List.of("task"))
                .withEnabled(true)
                .withBatchSize(10)
                .withPollInterval(1)
                .withDestinations(List.of(destination)));
  }

  private long processedNotificationEvents(EventSubscription subscription) {
    JsonNode diagnostic =
        JSON.valueToTree(
            SdkClients.adminClient()
                .getHttpClient()
                .execute(
                    HttpMethod.GET,
                    "/v1/events/subscriptions/id/" + subscription.getId() + "/diagnosticInfo",
                    null,
                    Object.class));
    return diagnostic.path("successfulEventsCount").asLong()
        + diagnostic.path("failedEventsCount").asLong();
  }

  private static void assertHistoryNewestFirst(EntityHistory history) {
    assertNotNull(history);
    assertNotNull(history.getVersions());
    assertFalse(history.getVersions().isEmpty());
    List<JsonNode> versions = parseHistoryVersions(history);
    if (versions.size() > 1) {
      assertTrue(
          versions.getFirst().path("version").asDouble()
              >= versions.getLast().path("version").asDouble());
    }
  }

  private static void assertHistoryContains(
      EntityHistory history, String fieldName, String expectedValue) {
    assertHistoryNewestFirst(history);
    assertTrue(
        parseHistoryVersions(history).stream()
            .flatMap(version -> version.findValuesAsText(fieldName).stream())
            .anyMatch(expectedValue::equals),
        () -> "Expected history field " + fieldName + " to contain " + expectedValue);
  }

  private static List<JsonNode> parseHistoryVersions(EntityHistory history) {
    return history.getVersions().stream()
        .map(
            version ->
                version instanceof String json
                    ? JsonUtils.readValue(json, JsonNode.class)
                    : JSON.valueToTree(version))
        .toList();
  }

  // ===================================================================
  // ASSETS
  // ===================================================================

  @Test
  void post_createMetricPreservesDeprecatedAssets(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = ShortStackFactory.table(ns);
    Metric metric =
        createEntity(
            createRequest(ns.prefix("create_assets_metric"), ns)
                .withAssets(List.of(table.getEntityReference().withType(Entity.TABLE))));

    JsonNode assets = getMetricAssets(client, metric);
    assertEquals(1, assets.get("paging").get("total").asInt());
    assertEquals(
        table.getId().toString(), assets.get("data").get(0).get("asset").get("id").asText());
  }

  @Test
  void put_bulkAddAndRemoveAssets(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Metric metric = createEntity(createRequest(ns.prefix("assets_metric"), ns));
    Table table = ShortStackFactory.table(ns);

    BulkAssets request =
        new BulkAssets().withAssets(List.of(table.getEntityReference().withType("table")));
    client
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/metrics/" + metric.getFullyQualifiedName() + "/assets/add",
            request,
            BulkOperationResult.class);

    JsonNode withAssets = getMetricAssets(client, metric);
    assertEquals(1, withAssets.get("paging").get("total").asInt());
    assertEquals(
        table.getId().toString(), withAssets.get("data").get(0).get("asset").get("id").asText());

    client
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/metrics/" + metric.getFullyQualifiedName() + "/assets/remove",
            request,
            BulkOperationResult.class);

    JsonNode withoutAssets = getMetricAssets(client, metric);
    assertEquals(0, withoutAssets.get("paging").get("total").asInt());
    assertTrue(
        withoutAssets.get("data").isEmpty(), "Assets should be unlinked after a bulk remove");
  }

  @Test
  void get_metricAssets_annotatesDirection(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Metric metric = createEntity(createRequest(ns.prefix("direction_metric"), ns));
    Table table = ShortStackFactory.table(ns);

    BulkAssets request =
        new BulkAssets().withAssets(List.of(table.getEntityReference().withType("table")));
    client
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/metrics/" + metric.getFullyQualifiedName() + "/assets/add",
            request,
            BulkOperationResult.class);

    JsonNode response =
        JSON.valueToTree(
            client
                .getHttpClient()
                .execute(
                    HttpMethod.GET,
                    "/v1/metrics/"
                        + metric.getId()
                        + "/assets?limit=1&offset=0&q="
                        + table.getName()
                        + "&entityType=table&direction=unrelated",
                    null,
                    Object.class));

    assertEquals(1, response.get("paging").get("total").asInt());
    assertEquals(1, response.get("data").size());
    JsonNode annotated = response.get("data").get(0);
    assertEquals(table.getId().toString(), annotated.get("asset").get("id").asText());
    assertEquals(
        "unrelated",
        annotated.get("direction").asText(),
        "With no lineage edge, a linked asset is neither upstream nor downstream");
  }

  @Test
  void get_metricAssetsFiltersMixedEntityTypesAndBothLineageDirections(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Metric metric = createEntity(createRequest(ns.prefix("direction_filter_metric"), ns));
    Table upstream = ShortStackFactory.table(ns);
    Table downstream = ShortStackFactory.table(ns);
    DashboardService dashboardService = DashboardServiceTestFactory.createMetabase(ns);
    Dashboard dashboard =
        client
            .dashboards()
            .create(
                new CreateDashboard()
                    .withName(ns.prefix("direction_filter_dashboard"))
                    .withService(dashboardService.getFullyQualifiedName()));
    BulkAssets assets =
        new BulkAssets()
            .withAssets(
                List.of(
                    upstream.getEntityReference().withType("table"),
                    downstream.getEntityReference().withType("table"),
                    dashboard.getEntityReference().withType("dashboard")));
    client
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/metrics/" + metric.getFullyQualifiedName() + "/assets/add",
            assets,
            BulkOperationResult.class);
    client
        .lineage()
        .addLineage(
            new AddLineage()
                .withEdge(
                    new EntitiesEdge()
                        .withFromEntity(upstream.getEntityReference())
                        .withToEntity(metric.getEntityReference())));
    client
        .lineage()
        .addLineage(
            new AddLineage()
                .withEdge(
                    new EntitiesEdge()
                        .withFromEntity(metric.getEntityReference())
                        .withToEntity(downstream.getEntityReference())));

    assertSingleMetricAsset(
        getMetricAssets(client, metric, "limit=10&offset=0&entityType=table&direction=upstream"),
        upstream.getEntityReference(),
        "upstream");
    assertSingleMetricAsset(
        getMetricAssets(client, metric, "limit=10&offset=0&entityType=table&direction=downstream"),
        downstream.getEntityReference(),
        "downstream");
    assertSingleMetricAsset(
        getMetricAssets(
            client, metric, "limit=10&offset=0&entityType=dashboard&direction=unrelated"),
        dashboard.getEntityReference(),
        "unrelated");
    assertEquals(
        2,
        getMetricAssets(client, metric, "limit=10&offset=0&entityType=table")
            .path("paging")
            .path("total")
            .asInt());
  }

  @Test
  void metricAssetsApplyRbacBeforePagingFilteringAndPartialBulkResults(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Metric metric = createEntity(createRequest(ns.prefix("assets_rbac_metric"), ns));
    Table visible = ShortStackFactory.table(ns);
    Table secondVisible = ShortStackFactory.table(ns);
    Table restricted = ShortStackFactory.table(ns);
    restricted.setTags(List.of(new TagLabel().withTagFQN(RESTRICTED_TAG_FQN)));
    restricted = admin.tables().update(restricted.getId().toString(), restricted);
    admin
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/metrics/" + metric.getFullyQualifiedName() + "/assets/add",
            new BulkAssets()
                .withAssets(
                    List.of(
                        visible.getEntityReference().withType("table"),
                        restricted.getEntityReference().withType("table"))),
            BulkOperationResult.class);

    Rule allowCatalog =
        new Rule()
            .withName("AllowMetricAssetAccess")
            .withResources(List.of("All"))
            .withOperations(
                List.of(
                    MetadataOperation.VIEW_BASIC,
                    MetadataOperation.VIEW_ALL,
                    MetadataOperation.EDIT_ALL))
            .withEffect(Rule.Effect.ALLOW);
    Rule denyRestrictedTables =
        new Rule()
            .withName("DenyRestrictedMetricAssets")
            .withResources(List.of("table"))
            .withOperations(List.of(MetadataOperation.VIEW_BASIC, MetadataOperation.VIEW_ALL))
            .withCondition("matchAnyTag('" + RESTRICTED_TAG_FQN + "')")
            .withEffect(Rule.Effect.DENY);
    String suffix = ns.uniqueShortId();
    Policy policy =
        admin
            .policies()
            .create(
                new CreatePolicy()
                    .withName("metricAssetPolicy_" + suffix)
                    .withRules(List.of(allowCatalog, denyRestrictedTables)));
    try {
      Role role =
          admin
              .roles()
              .create(
                  new CreateRole()
                      .withName("metricAssetRole_" + suffix)
                      .withPolicies(List.of(policy.getFullyQualifiedName())));
      try {
        String email = "metric-assets-" + suffix + "@test.openmetadata.org";
        User user =
            admin
                .users()
                .create(
                    new CreateUser()
                        .withName("metric-assets-" + suffix)
                        .withEmail(email)
                        .withRoles(List.of(role.getId())));
        try {
          OpenMetadataClient restrictedClient =
              SdkClients.createClient(email, email, new String[] {});
          JsonNode firstPage =
              getMetricAssets(restrictedClient, metric, "limit=1&offset=0&entityType=table");
          JsonNode secondPage =
              getMetricAssets(restrictedClient, metric, "limit=1&offset=1&entityType=table");
          JsonNode restrictedSearch =
              getMetricAssets(
                  restrictedClient,
                  metric,
                  "limit=10&offset=0&q=" + restricted.getName() + "&entityType=table");
          JsonNode directionFilter =
              getMetricAssets(
                  restrictedClient,
                  metric,
                  "limit=10&offset=0&q="
                      + visible.getName()
                      + "&entityType=table&direction=unrelated");

          assertEquals(1, firstPage.path("paging").path("total").asInt());
          assertEquals(
              visible.getId().toString(),
              firstPage.path("data").get(0).path("asset").path("id").asText());
          assertTrue(secondPage.path("data").isEmpty());
          assertEquals(1, secondPage.path("paging").path("total").asInt());
          assertEquals(0, restrictedSearch.path("paging").path("total").asInt());
          assertEquals(1, directionFilter.path("paging").path("total").asInt());
          assertFalse(firstPage.toString().contains(restricted.getName()));
          assertFalse(restrictedSearch.toString().contains(restricted.getName()));
          assertApiStatus(
              400,
              () -> getMetricAssets(restrictedClient, metric, "limit=0&offset=0&entityType=table"));
          assertApiStatus(
              400,
              () ->
                  getMetricAssets(restrictedClient, metric, "limit=1&offset=-1&entityType=table"));
          assertApiStatus(
              404,
              () ->
                  restrictedClient
                      .getHttpClient()
                      .execute(
                          HttpMethod.GET,
                          "/v1/metrics/" + UUID.randomUUID() + "/assets?limit=1&offset=0",
                          null,
                          Object.class));

          EntityReference restrictedById =
              new EntityReference().withId(restricted.getId()).withType("table");
          BulkOperationResult partial =
              restrictedClient
                  .getHttpClient()
                  .execute(
                      HttpMethod.PUT,
                      "/v1/metrics/" + metric.getFullyQualifiedName() + "/assets/add",
                      new BulkAssets()
                          .withAssets(
                              List.of(
                                  secondVisible.getEntityReference().withType("table"),
                                  restrictedById)),
                      BulkOperationResult.class);
          assertEquals(ApiStatus.PARTIAL_SUCCESS, partial.getStatus());
          assertEquals(1, partial.getNumberOfRowsPassed());
          assertEquals(1, partial.getNumberOfRowsFailed());
          JsonNode deniedRequest =
              JSON.valueToTree(partial.getFailedRequest().getFirst().getRequest());
          assertEquals(restricted.getId().toString(), deniedRequest.path("id").asText());
          assertTrue(
              deniedRequest.path("name").isMissingNode() || deniedRequest.path("name").isNull());
          assertFalse(JsonUtils.pojoToJson(partial).contains(restricted.getName()));
          JsonNode visibleAfterBulk =
              getMetricAssets(
                  restrictedClient,
                  metric,
                  "limit=10&offset=0&q=" + secondVisible.getName() + "&entityType=table");
          assertEquals(1, visibleAfterBulk.path("paging").path("total").asInt());

          BulkOperationResult partialRemove =
              restrictedClient
                  .getHttpClient()
                  .execute(
                      HttpMethod.PUT,
                      "/v1/metrics/" + metric.getFullyQualifiedName() + "/assets/remove",
                      new BulkAssets()
                          .withAssets(
                              List.of(
                                  visible.getEntityReference().withType("table"), restrictedById)),
                      BulkOperationResult.class);
          assertEquals(ApiStatus.PARTIAL_SUCCESS, partialRemove.getStatus());
          assertEquals(2, partialRemove.getNumberOfRowsProcessed());
          assertEquals(1, partialRemove.getNumberOfRowsPassed());
          assertEquals(1, partialRemove.getNumberOfRowsFailed());
          assertEquals(
              0,
              getMetricAssets(
                      restrictedClient,
                      metric,
                      "limit=10&offset=0&q=" + visible.getName() + "&entityType=table")
                  .path("paging")
                  .path("total")
                  .asInt());
          assertEquals(
              1,
              getMetricAssets(
                      admin,
                      metric,
                      "limit=10&offset=0&q=" + restricted.getName() + "&entityType=table")
                  .path("paging")
                  .path("total")
                  .asInt());
        } finally {
          admin.users().delete(user.getId());
        }
      } finally {
        admin.roles().delete(role.getId());
      }
    } finally {
      admin.policies().delete(policy.getId());
    }
  }

  @Test
  void metricDimensionAndMeasureSupportColumnLineageRoundTrips(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = ShortStackFactory.table(ns);
    Metric metric =
        createEntity(
            createRequest(ns.prefix("lineage_metric_children"), ns)
                .withDimensions(List.of(new MetricDimension().withName("region")))
                .withMeasures(List.of(new MetricMeasure().withName("revenue"))));
    String tableColumn = table.getColumns().getFirst().getFullyQualifiedName();
    String dimension = metric.getFullyQualifiedName() + ".dimension.region";
    String measure = metric.getFullyQualifiedName() + ".measure.revenue";
    LineageDetails details =
        new LineageDetails()
            .withColumnsLineage(
                List.of(
                    new ColumnLineage()
                        .withFromColumns(List.of(tableColumn))
                        .withToColumn(dimension),
                    new ColumnLineage()
                        .withFromColumns(List.of(tableColumn))
                        .withToColumn(measure)));

    client
        .lineage()
        .addLineage(
            new AddLineage()
                .withEdge(
                    new EntitiesEdge()
                        .withFromEntity(table.getEntityReference())
                        .withToEntity(metric.getEntityReference())
                        .withLineageDetails(details)));

    EntityLineage lineage =
        JSON.readValue(
            client.lineage().getEntityLineage("metric", metric.getId().toString(), "1", "0"),
            EntityLineage.class);
    Edge edge =
        lineage.getUpstreamEdges().stream()
            .filter(candidate -> candidate.getFromEntity().equals(table.getId()))
            .findFirst()
            .orElseThrow();
    assertEquals(2, edge.getLineageDetails().getColumnsLineage().size());
    assertEquals(
        List.of(dimension, measure),
        edge.getLineageDetails().getColumnsLineage().stream()
            .map(ColumnLineage::getToColumn)
            .toList());
  }

  // ===================================================================
  // OBSERVABILITY
  // ===================================================================

  @Test
  void get_metricObservability_withoutAssets_isUnknown(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Metric metric = createEntity(createRequest(ns.prefix("obs_bare"), ns));

    JsonNode observability =
        JSON.valueToTree(
            client
                .getHttpClient()
                .execute(
                    HttpMethod.GET,
                    "/v1/metrics/" + metric.getId() + "/observability",
                    null,
                    Object.class));

    assertEquals("Unknown", observability.get("health").asText());
    assertEquals(0, observability.get("upstreamAssetCount").asInt());
    assertEquals("NoLinkedAssets", observability.get("reasonCode").asText());
    assertApiStatus(
        404,
        () ->
            client
                .getHttpClient()
                .execute(
                    HttpMethod.GET,
                    "/v1/metrics/" + UUID.randomUUID() + "/observability",
                    null,
                    Object.class));
  }

  @Test
  void get_metricObservability_downstreamAndUnrelatedAssetsAreNotScored(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Metric metric = createEntity(createRequest(ns.prefix("obs_downstream"), ns));
    Table downstream = ShortStackFactory.table(ns);
    Table unrelated = ShortStackFactory.table(ns);

    BulkAssets request =
        new BulkAssets()
            .withAssets(
                List.of(
                    downstream.getEntityReference().withType("table"),
                    unrelated.getEntityReference().withType("table")));
    client
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/metrics/" + metric.getFullyQualifiedName() + "/assets/add",
            request,
            BulkOperationResult.class);
    client
        .lineage()
        .addLineage(
            new AddLineage()
                .withEdge(
                    new EntitiesEdge()
                        .withFromEntity(metric.getEntityReference())
                        .withToEntity(downstream.getEntityReference())));
    TestCase downstreamTest =
        TestCaseBuilder.create(client)
            .name(ns.uniqueShortId() + "_downstream")
            .forTable(downstream)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "10")
            .create();
    client
        .testCaseResults()
        .create(
            downstreamTest.getFullyQualifiedName(),
            testResult(TestCaseStatus.Failed, System.currentTimeMillis()));

    JsonNode observability =
        JSON.valueToTree(
            client
                .getHttpClient()
                .execute(
                    HttpMethod.GET,
                    "/v1/metrics/" + metric.getId() + "/observability",
                    null,
                    Object.class));

    assertEquals(
        "Unknown",
        observability.get("health").asText(),
        "Downstream and unrelated asset tests cannot score a metric");
    assertEquals(0, observability.get("upstreamAssetCount").asInt());
    assertEquals("NoUpstreamTables", observability.get("reasonCode").asText());
    Map<String, String> directions = new HashMap<>();
    observability
        .get("linkedAssets")
        .forEach(
            item ->
                directions.put(
                    item.get("asset").get("id").asText(), item.get("direction").asText()));
    assertEquals("downstream", directions.get(downstream.getId().toString()));
    assertEquals("unrelated", directions.get(unrelated.getId().toString()));
  }

  @Test
  void get_metricObservabilityUsesLatestTableAndColumnTests(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Metric metric = createEntity(createRequest(ns.prefix("obs_scored"), ns));
    Table table = ShortStackFactory.table(ns);
    BulkAssets assets =
        new BulkAssets().withAssets(List.of(table.getEntityReference().withType("table")));
    client
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/metrics/" + metric.getFullyQualifiedName() + "/assets/add",
            assets,
            BulkOperationResult.class);
    client
        .lineage()
        .addLineage(
            new AddLineage()
                .withEdge(
                    new EntitiesEdge()
                        .withFromEntity(table.getEntityReference())
                        .withToEntity(metric.getEntityReference())));

    TestDefinition consistencyDefinition =
        client
            .testDefinitions()
            .create(
                new CreateTestDefinition()
                    .withName(ns.uniqueShortId() + "_consistency")
                    .withDescription("Consistency dimension for Metric observability")
                    .withEntityType(TestDefinitionEntityType.TABLE)
                    .withTestPlatforms(List.of(TestPlatform.OPEN_METADATA))
                    .withDataQualityDimension(DataQualityDimensions.CONSISTENCY));
    TestCase tableTest =
        TestCaseBuilder.create(client)
            .name(ns.uniqueShortId() + "_table")
            .forTable(table)
            .testDefinition(consistencyDefinition.getFullyQualifiedName())
            .create();
    TestCase columnTest =
        TestCaseBuilder.create(client)
            .name(ns.uniqueShortId() + "_column")
            .forColumn(table, "id")
            .testDefinition("columnValuesToBeNotNull")
            .create();
    TestCase queuedTest =
        TestCaseBuilder.create(client)
            .name(ns.uniqueShortId() + "_queued")
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "10")
            .create();
    TestCase missingTest =
        TestCaseBuilder.create(client)
            .name(ns.uniqueShortId() + "_missing")
            .forColumn(table, "v")
            .testDefinition("columnValuesToBeNotNull")
            .create();

    long start = System.currentTimeMillis() - 10_000L;
    client
        .testCaseResults()
        .create(tableTest.getFullyQualifiedName(), testResult(TestCaseStatus.Success, start + 100));
    client
        .testCaseResults()
        .create(
            columnTest.getFullyQualifiedName(), testResult(TestCaseStatus.Success, start + 200));
    UUID incidentStateId =
        client
            .testCaseResults()
            .create(
                tableTest.getFullyQualifiedName(), testResult(TestCaseStatus.Failed, start + 300))
            .getIncidentId();
    TestCaseResolutionStatus incident = awaitIncidentStatus(client, incidentStateId);
    JsonNode severityPatch =
        JSON.createArrayNode()
            .add(
                JSON.createObjectNode()
                    .put("op", "add")
                    .put("path", "/severity")
                    .put("value", Severity.Severity1.value()));
    incident = client.testCaseResolutionStatuses().patch(incident.getId(), severityPatch);
    assertEquals(
        Severity.Severity1,
        client.testCaseResolutionStatuses().get(incident.getId()).getSeverity());
    client
        .testCaseResults()
        .create(queuedTest.getFullyQualifiedName(), testResult(TestCaseStatus.Queued, start + 400));

    JsonNode observability =
        JSON.valueToTree(
            client
                .getHttpClient()
                .execute(
                    HttpMethod.GET,
                    "/v1/metrics/" + metric.getId() + "/observability",
                    null,
                    Object.class));

    assertEquals("Degraded", observability.get("health").asText());
    assertEquals("Degraded", observability.get("reasonCode").asText());
    assertEquals(50.0, observability.get("score").asDouble());
    assertEquals(1, observability.get("statusCounts").get("passed").asInt());
    assertEquals(1, observability.get("statusCounts").get("failed").asInt());
    assertEquals(1, observability.get("statusCounts").get("queued").asInt());
    assertEquals(1, observability.get("statusCounts").get("missing").asInt());
    assertEquals(2, observability.get("statusCounts").get("terminal").asInt());
    JsonNode consistency = null;
    for (JsonNode dimension : observability.get("dimensions")) {
      if (DataQualityDimensions.CONSISTENCY.value().equals(dimension.get("dimension").asText())) {
        consistency = dimension;
        break;
      }
    }
    assertNotNull(consistency);
    assertEquals(1, consistency.get("total").asInt());
    assertEquals(0, consistency.get("passed").asInt());
    assertEquals(1, consistency.get("failed").asInt());
    assertEquals(start + 300, observability.get("latestRunTime").asLong());
    assertEquals(4, observability.get("tests").size());
    assertEquals(1, observability.get("incidents").size());
    assertEquals(
        tableTest.getId().toString(),
        observability.get("incidents").get(0).get("testCase").get("id").asText());
    assertEquals(
        table.getId().toString(),
        observability.get("incidents").get(0).get("asset").get("id").asText());
    assertEquals("New", observability.get("incidents").get(0).get("status").asText());
    assertEquals("Severity1", observability.get("incidents").get(0).get("severity").asText());
    assertEquals(1, observability.get("sourceCoverage").get("testedTables").asInt());
    assertNotNull(missingTest);
  }

  @Test
  void get_metricObservabilityDoesNotTruncateActiveTestsAndExcludesDeletedTests(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Metric metric = createEntity(createRequest(ns.prefix("obs_complete_active_set"), ns));
    Table table = ShortStackFactory.table(ns);
    client
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/metrics/" + metric.getFullyQualifiedName() + "/assets/add",
            new BulkAssets().withAssets(List.of(table.getEntityReference().withType("table"))),
            BulkOperationResult.class);
    client
        .lineage()
        .addLineage(
            new AddLineage()
                .withEdge(
                    new EntitiesEdge()
                        .withFromEntity(table.getEntityReference())
                        .withToEntity(metric.getEntityReference())));

    long resultBase = System.currentTimeMillis() - 100_000L;
    List<TestCase> activeTests = new ArrayList<>();
    for (int index = 0; index < 6; index++) {
      TestCase tableTest =
          TestCaseBuilder.create(client)
              .name(ns.uniqueShortId() + "_obs_table_" + index)
              .forTable(table)
              .testDefinition("tableRowCountToEqual")
              .parameter("value", "10")
              .create();
      activeTests.add(tableTest);
      if (index == 0) {
        client
            .testCaseResults()
            .create(
                tableTest.getFullyQualifiedName(),
                testResult(TestCaseStatus.Aborted, resultBase + 100));
      }
      client
          .testCaseResults()
          .create(
              tableTest.getFullyQualifiedName(),
              testResult(TestCaseStatus.Success, resultBase + 1_000 + index));
    }
    for (int index = 0; index < 6; index++) {
      TestCase columnTest =
          TestCaseBuilder.create(client)
              .name(ns.uniqueShortId() + "_obs_column_" + index)
              .forColumn(table, "id")
              .testDefinition("columnValuesToBeNotNull")
              .create();
      activeTests.add(columnTest);
      if (index == 4) {
        client
            .testCaseResults()
            .create(
                columnTest.getFullyQualifiedName(),
                testResult(TestCaseStatus.Success, resultBase + 1_500));
      }
      TestCaseStatus latestStatus = index < 4 ? TestCaseStatus.Success : TestCaseStatus.Aborted;
      client
          .testCaseResults()
          .create(
              columnTest.getFullyQualifiedName(),
              testResult(latestStatus, resultBase + 2_000 + index));
    }

    TestCase deletedTest =
        TestCaseBuilder.create(client)
            .name(ns.uniqueShortId() + "_obs_deleted")
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "10")
            .create();
    UUID deletedIncidentId =
        client
            .testCaseResults()
            .create(
                deletedTest.getFullyQualifiedName(),
                testResult(TestCaseStatus.Failed, resultBase + 3_000))
            .getIncidentId();
    awaitIncidentStatus(client, deletedIncidentId);
    client.testCases().delete(deletedTest.getId().toString(), Map.of("recursive", "true"));

    JsonNode observability = getObservability(client, metric);
    double expectedScore = (10.0 / 12.0) * 100.0;
    assertEquals("AtRisk", observability.path("health").asText());
    assertEquals("AtRisk", observability.path("reasonCode").asText());
    assertEquals(expectedScore, observability.path("score").asDouble(), 0.0001);
    assertEquals(resultBase + 2_005, observability.path("latestRunTime").asLong());
    assertEquals(1, observability.path("upstreamAssetCount").asInt());
    assertEquals(1, observability.path("evaluatedAssetCount").asInt());
    assertEquals(12, observability.path("tests").size());
    List<String> returnedTestIds = new ArrayList<>();
    observability
        .path("tests")
        .forEach(test -> returnedTestIds.add(test.path("testCase").path("id").asText()));
    assertEquals(12, returnedTestIds.size());
    activeTests.forEach(
        test ->
            assertTrue(
                returnedTestIds.contains(test.getId().toString()),
                () -> "Active test was truncated from observability: " + test.getName()));
    assertFalse(returnedTestIds.contains(deletedTest.getId().toString()));

    JsonNode statusCounts = observability.path("statusCounts");
    assertEquals(10, statusCounts.path("passed").asInt());
    assertEquals(0, statusCounts.path("failed").asInt());
    assertEquals(2, statusCounts.path("aborted").asInt());
    assertEquals(0, statusCounts.path("queued").asInt());
    assertEquals(0, statusCounts.path("missing").asInt());
    assertEquals(12, statusCounts.path("terminal").asInt());

    JsonNode source = observability.path("assets").get(0);
    assertEquals(table.getId().toString(), source.path("asset").path("id").asText());
    assertEquals(12, source.path("total").asInt());
    assertEquals(10, source.path("passed").asInt());
    assertEquals(0, source.path("failed").asInt());
    assertEquals(2, source.path("aborted").asInt());
    assertEquals(expectedScore, source.path("score").asDouble(), 0.0001);

    JsonNode coverage = observability.path("sourceCoverage");
    assertEquals(1, coverage.path("upstreamTables").asInt());
    assertEquals(1, coverage.path("testedTables").asInt());
    assertEquals(1, coverage.path("visibleTables").asInt());
    assertEquals(0, coverage.path("restrictedTables").asInt());
    assertEquals(100.0, coverage.path("coveragePercent").asDouble());

    Map<String, JsonNode> dimensions = new HashMap<>();
    observability
        .path("dimensions")
        .forEach(dimension -> dimensions.put(dimension.path("dimension").asText(), dimension));
    assertFalse(dimensions.isEmpty());
    assertEquals(
        12,
        dimensions.values().stream().mapToInt(dimension -> dimension.path("total").asInt()).sum());
    assertEquals(
        10,
        dimensions.values().stream().mapToInt(dimension -> dimension.path("passed").asInt()).sum());
    assertEquals(
        0,
        dimensions.values().stream().mapToInt(dimension -> dimension.path("failed").asInt()).sum());
    assertEquals(
        2,
        dimensions.values().stream()
            .mapToInt(dimension -> dimension.path("aborted").asInt())
            .sum());
    assertEquals(0, observability.path("incidents").size());
  }

  @Test
  void get_metricObservabilityRedactsRestrictedSourcesButPreservesGlobalScore(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Metric metric = createEntity(createRequest(ns.prefix("obs_restricted"), ns));
    Table table = ShortStackFactory.table(ns);
    BulkAssets assets =
        new BulkAssets().withAssets(List.of(table.getEntityReference().withType("table")));
    admin
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/metrics/" + metric.getFullyQualifiedName() + "/assets/add",
            assets,
            BulkOperationResult.class);
    admin
        .lineage()
        .addLineage(
            new AddLineage()
                .withEdge(
                    new EntitiesEdge()
                        .withFromEntity(table.getEntityReference())
                        .withToEntity(metric.getEntityReference())));
    TestCase failedTest =
        TestCaseBuilder.create(admin)
            .name(ns.uniqueShortId() + "_restricted")
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "10")
            .create();
    long resultTime = System.currentTimeMillis();
    UUID incidentStateId =
        admin
            .testCaseResults()
            .create(
                failedTest.getFullyQualifiedName(), testResult(TestCaseStatus.Failed, resultTime))
            .getIncidentId();
    awaitIncidentStatus(admin, incidentStateId);
    JsonNode full = getObservability(admin, metric);

    Rule allowCatalog =
        new Rule()
            .withName("AllowCatalog")
            .withResources(List.of("All"))
            .withOperations(List.of(MetadataOperation.VIEW_ALL))
            .withEffect(Rule.Effect.ALLOW);
    Rule denyTables =
        new Rule()
            .withName("DenyTables")
            .withResources(List.of("table"))
            .withOperations(List.of(MetadataOperation.VIEW_ALL))
            .withEffect(Rule.Effect.DENY);
    String suffix = ns.uniqueShortId();
    Policy policy =
        admin
            .policies()
            .create(
                new CreatePolicy()
                    .withName("metricObsPolicy_" + suffix)
                    .withRules(List.of(allowCatalog, denyTables)));
    try {
      Role role =
          admin
              .roles()
              .create(
                  new CreateRole()
                      .withName("metricObsRole_" + suffix)
                      .withPolicies(List.of(policy.getFullyQualifiedName())));
      try {
        String email = "metric-obs-" + suffix + "@test.openmetadata.org";
        User user =
            admin
                .users()
                .create(
                    new CreateUser()
                        .withName("metric-obs-" + suffix)
                        .withEmail(email)
                        .withRoles(List.of(role.getId())));
        try {
          OpenMetadataClient restricted = SdkClients.createClient(email, email, new String[] {});
          assertApiStatus(403, () -> restricted.tables().get(table.getId().toString()));

          JsonNode redacted = getObservability(restricted, metric);

          assertEquals(full.get("score").asDouble(), redacted.get("score").asDouble());
          assertEquals(full.get("health").asText(), redacted.get("health").asText());
          assertEquals(full.get("statusCounts"), redacted.get("statusCounts"));
          assertEquals(resultTime, redacted.get("latestRunTime").asLong());
          assertEquals(1, redacted.get("upstreamAssetCount").asInt());
          assertEquals(0, redacted.get("sourceCoverage").get("visibleTables").asInt());
          assertEquals(1, redacted.get("sourceCoverage").get("restrictedTables").asInt());
          assertTrue(redacted.get("partial").asBoolean());
          assertEquals("PartialDetails", redacted.get("reasonCode").asText());
          assertEquals(0, redacted.get("assets").size());
          assertEquals(0, redacted.get("linkedAssets").size());
          assertEquals(0, redacted.get("tests").size());
          assertEquals(0, redacted.get("incidents").size());
        } finally {
          admin.users().delete(user.getId());
        }
      } finally {
        admin.roles().delete(role.getId());
      }
    } finally {
      admin.policies().delete(policy.getId());
    }
  }

  private JsonNode getObservability(OpenMetadataClient client, Metric metric) {
    return JSON.valueToTree(
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/metrics/" + metric.getId() + "/observability",
                null,
                Object.class));
  }

  private JsonNode getMetricAssets(OpenMetadataClient client, Metric metric) {
    return getMetricAssets(client, metric, "limit=100&offset=0");
  }

  private JsonNode getMetricAssets(
      OpenMetadataClient client, Metric metric, String queryParameters) {
    return JSON.valueToTree(
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/metrics/" + metric.getId() + "/assets?" + queryParameters,
                null,
                Object.class));
  }

  private static void assertSingleMetricAsset(
      JsonNode response, EntityReference expectedAsset, String expectedDirection) {
    assertEquals(1, response.path("paging").path("total").asInt());
    assertEquals(1, response.path("data").size());
    JsonNode asset = response.path("data").get(0);
    assertEquals(expectedAsset.getId().toString(), asset.path("asset").path("id").asText());
    assertEquals(expectedAsset.getType(), asset.path("asset").path("type").asText());
    assertEquals(expectedDirection, asset.path("direction").asText());
  }

  private static void withRestrictedHierarchyDestinationEditor(
      TestNamespace ns, Consumer<OpenMetadataClient> assertions) {
    OpenMetadataClient admin = SdkClients.adminClient();
    String suffix = ns.uniqueShortId();
    Rule allowCatalog =
        new Rule()
            .withName("AllowHierarchyDestinationWrites")
            .withResources(List.of("All"))
            .withOperations(
                List.of(
                    MetadataOperation.CREATE,
                    MetadataOperation.VIEW_ALL,
                    MetadataOperation.EDIT_ALL))
            .withEffect(Rule.Effect.ALLOW);
    Rule denyRestrictedDestinations =
        new Rule()
            .withName("DenyRestrictedHierarchyDestinations")
            .withResources(List.of("metric", "metricGroup"))
            .withOperations(List.of(MetadataOperation.EDIT_ALL))
            .withCondition("matchAnyTag('" + RESTRICTED_TAG_FQN + "')")
            .withEffect(Rule.Effect.DENY);
    Policy policy =
        admin
            .policies()
            .create(
                new CreatePolicy()
                    .withName("metricDestinationPolicy_" + suffix)
                    .withRules(List.of(allowCatalog, denyRestrictedDestinations)));
    try {
      Role role =
          admin
              .roles()
              .create(
                  new CreateRole()
                      .withName("metricDestinationRole_" + suffix)
                      .withPolicies(List.of(policy.getFullyQualifiedName())));
      try {
        String userName = "metric-destination-writer-" + suffix;
        String email = userName + "@test.openmetadata.org";
        User user =
            admin
                .users()
                .create(
                    new CreateUser()
                        .withName(userName)
                        .withEmail(email)
                        .withRoles(List.of(role.getId())));
        try {
          assertions.accept(SdkClients.createClient(email, email, new String[] {}));
        } finally {
          admin.users().delete(user.getId());
        }
      } finally {
        admin.roles().delete(role.getId());
      }
    } finally {
      admin.policies().delete(policy.getId());
    }
  }

  private static void assertApiStatus(int expectedStatus, Executable request) {
    Throwable current = assertThrows(Throwable.class, request);
    OpenMetadataException apiFailure = null;
    while (current != null) {
      if (current instanceof OpenMetadataException candidate && candidate.getStatusCode() > 0) {
        apiFailure = candidate;
        break;
      }
      current = current.getCause();
    }
    assertNotNull(apiFailure, "Expected an SDK API exception with an HTTP status");
    assertEquals(expectedStatus, apiFailure.getStatusCode());
  }

  private static TestCaseResolutionStatus awaitIncidentStatus(
      OpenMetadataClient client, UUID stateId) {
    AtomicReference<TestCaseResolutionStatus> incident = new AtomicReference<>();
    Awaitility.await("incident status synchronized from its task")
        .atMost(Duration.ofSeconds(10))
        .pollInterval(Duration.ofMillis(100))
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              JsonNode response =
                  JSON.valueToTree(
                      client
                          .getHttpClient()
                          .execute(
                              HttpMethod.GET,
                              "/v1/dataQuality/testCases/testCaseIncidentStatus/stateId/" + stateId,
                              null,
                              Object.class));
              assertFalse(response.path("data").isEmpty());
              TestCaseResolutionStatus status =
                  JSON.convertValue(response.path("data").get(0), TestCaseResolutionStatus.class);
              assertNotNull(status.getId());
              incident.set(status);
            });
    return incident.get();
  }

  private CreateTestCaseResult testResult(TestCaseStatus status, long timestamp) {
    return new CreateTestCaseResult()
        .withTimestamp(timestamp)
        .withTestCaseStatus(status)
        .withResult(status.value());
  }

  // ===================================================================
  // BULK API SUPPORT
  // ===================================================================

  @Test
  void bulkCreateInvalidatesPreviouslyCachedMissingMetric(TestNamespace ns) {
    String metricName = ns.prefix("bulk_negative_cache");
    assertApiStatus(404, () -> getEntityByName(metricName));

    BulkOperationResult result = executeBulkCreate(List.of(createRequest(metricName, ns)));

    assertEquals(ApiStatus.SUCCESS, result.getStatus());
    assertEquals(1, result.getNumberOfRowsPassed());
    assertEquals(metricName, getEntityByName(metricName).getFullyQualifiedName());
  }

  @Test
  void relationshipJsonInsertAndDuplicateUpdatePreserveUnicode(TestNamespace ns) throws Exception {
    Metric metric = createEntity(createRequest(ns.prefix("relationship_json"), ns));
    int relation = Relationship.RELATED_TO.ordinal();
    String relationType = "unicode_" + ns.uniqueShortId();
    CollectionDAO.EntityRelationshipDAO dao = Entity.getCollectionDAO().relationshipDAO();

    try {
      dao.insert(
          metric.getId(),
          metric.getId(),
          Entity.METRIC,
          Entity.METRIC,
          relation,
          relationType,
          "{\"label\":\"Métrica 東京 📈\"}");
      List<CollectionDAO.EntityRelationshipRecord> relationships =
          dao.findTo(metric.getId(), Entity.METRIC, relation).stream()
              .filter(record -> metric.getId().equals(record.getId()))
              .toList();
      assertEquals(1, relationships.size());
      assertEquals(
          "Métrica 東京 📈", JSON.readTree(relationships.getFirst().getJson()).get("label").asText());

      dao.insert(
          metric.getId(),
          metric.getId(),
          Entity.METRIC,
          Entity.METRIC,
          relation,
          relationType,
          "{\"label\":\"Résumé Київ ✅\"}");
      relationships =
          dao.findTo(metric.getId(), Entity.METRIC, relation).stream()
              .filter(record -> metric.getId().equals(record.getId()))
              .toList();
      assertEquals(1, relationships.size());
      assertEquals(
          "Résumé Київ ✅", JSON.readTree(relationships.getFirst().getJson()).get("label").asText());
    } finally {
      dao.deleteWithRelationType(
          metric.getId(), Entity.METRIC, metric.getId(), Entity.METRIC, relation, relationType);
    }
  }

  @Override
  protected BulkOperationResult executeBulkCreate(List<CreateMetric> createRequests) {
    return SdkClients.adminClient().metrics().bulkCreateOrUpdate(createRequests);
  }

  @Override
  protected BulkOperationResult executeBulkCreateAsync(List<CreateMetric> createRequests) {
    return SdkClients.adminClient().metrics().bulkCreateOrUpdateAsync(createRequests);
  }

  @Override
  protected CreateMetric createInvalidRequestForBulk(TestNamespace ns) {
    CreateMetric request = new CreateMetric();
    request.setName("");
    return request;
  }
}
