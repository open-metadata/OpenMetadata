package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateMetric;
import org.openmetadata.schema.api.data.MetricExpression;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.MetricExpressionLanguage;
import org.openmetadata.schema.type.MetricGranularity;
import org.openmetadata.schema.type.MetricType;
import org.openmetadata.schema.type.MetricUnitOfMeasurement;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

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
    java.util.Map<String, String> params = new java.util.HashMap<>();
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
}
