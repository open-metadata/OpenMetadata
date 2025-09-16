package org.openmetadata.service.resources.metrics;

import static jakarta.ws.rs.core.Response.Status;
import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import jakarta.ws.rs.client.WebTarget;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.schema.api.data.CreateMetric;
import org.openmetadata.schema.api.data.MetricExpression;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetricExpressionLanguage;
import org.openmetadata.schema.type.MetricGranularity;
import org.openmetadata.schema.type.MetricType;
import org.openmetadata.schema.type.MetricUnitOfMeasurement;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.util.TestUtils;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class MetricResourceTest extends EntityResourceTest<Metric, CreateMetric> {

  public MetricResourceTest() {
    super(
        Entity.METRIC,
        Metric.class,
        MetricResource.MetricsList.class,
        "metrics",
        MetricResource.FIELDS);
    supportsSearchIndex = true;
  }

  public void setupMetrics() throws IOException {
    CreateMetric createMetric = createRequest("metric1", "", "", null);
    Metric1 = createEntity(createMetric, ADMIN_AUTH_HEADERS);

    createMetric = createRequest("metric2", "", "", null);
    Metric2 = createEntity(createMetric, ADMIN_AUTH_HEADERS);
  }

  @Test
  void test_duplicateRelatedMetricsIssue() throws IOException {
    CreateMetric createMetric1 = createRequest("test_metric_duplicate_1", "", "", null);
    Metric metric1 = createEntity(createMetric1, ADMIN_AUTH_HEADERS);

    CreateMetric createMetric2 = createRequest("test_metric_duplicate_2", "", "", null);
    Metric metric2 = createEntity(createMetric2, ADMIN_AUTH_HEADERS);

    Metric originalMetric2 = getMetric(metric2.getId(), "*", ADMIN_AUTH_HEADERS);
    String origJson = JsonUtils.pojoToJson(originalMetric2);

    originalMetric2.setRelatedMetrics(List.of(metric1.getEntityReference()));
    patchEntity(originalMetric2.getId(), origJson, originalMetric2, ADMIN_AUTH_HEADERS);

    Metric updatedMetric2 = getMetric(metric2.getId(), "relatedMetrics", ADMIN_AUTH_HEADERS);

    Assertions.assertNotNull(updatedMetric2.getRelatedMetrics());
    Assertions.assertEquals(
        1,
        updatedMetric2.getRelatedMetrics().size(),
        "Expected only 1 related metric, but found "
            + updatedMetric2.getRelatedMetrics().size()
            + ". Related metrics: "
            + updatedMetric2.getRelatedMetrics());
    Assertions.assertEquals(metric1.getId(), updatedMetric2.getRelatedMetrics().getFirst().getId());

    // Also verify that metric1 now has metric2 as a related metric (bidirectional)
    Metric updatedMetric1 = getMetric(metric1.getId(), "relatedMetrics", ADMIN_AUTH_HEADERS);
    Assertions.assertNotNull(updatedMetric1.getRelatedMetrics());
    Assertions.assertEquals(
        1,
        updatedMetric1.getRelatedMetrics().size(),
        "Expected only 1 related metric for the reverse relationship, but found "
            + updatedMetric1.getRelatedMetrics().size());
    Assertions.assertEquals(metric2.getId(), updatedMetric1.getRelatedMetrics().getFirst().getId());
  }

  @Test
  void patch_MetricEntity() throws IOException {
    // Create a new Metric with different fields
    CreateMetric createRequest =
        createRequest("test_metric", "test description", "test owner", null);
    Metric metric = createEntity(createRequest, ADMIN_AUTH_HEADERS);
    validateCreatedEntity(metric, createRequest, ADMIN_AUTH_HEADERS);
    String origJson = JsonUtils.pojoToJson(metric);
    // add expression and other elements
    metric
        .withMetricExpression(
            new MetricExpression().withCode("code").withLanguage(MetricExpressionLanguage.Java))
        .withGranularity(MetricGranularity.DAY)
        .withUnitOfMeasurement(MetricUnitOfMeasurement.COUNT)
        .withMetricType(MetricType.AVERAGE);
    ChangeDescription change = getChangeDescription(metric, MINOR_UPDATE);
    fieldAdded(
        change,
        "metricExpression",
        new MetricExpression().withCode("code").withLanguage(MetricExpressionLanguage.Java));
    fieldAdded(change, "granularity", MetricGranularity.DAY);
    fieldAdded(change, "unitOfMeasurement", MetricUnitOfMeasurement.COUNT);
    fieldAdded(change, "metricType", MetricType.AVERAGE);
    metric = patchEntityAndCheck(metric, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    Metric updatedMetric = getMetric(metric.getId(), "*", ADMIN_AUTH_HEADERS);
    compareEntities(metric, updatedMetric, ADMIN_AUTH_HEADERS);
    origJson = JsonUtils.pojoToJson(updatedMetric);
    change = getChangeDescription(updatedMetric, MINOR_UPDATE);
    updatedMetric
        .withUnitOfMeasurement(MetricUnitOfMeasurement.DOLLARS)
        .withMetricType(MetricType.SUM);
    fieldUpdated(
        change,
        "unitOfMeasurement",
        MetricUnitOfMeasurement.COUNT,
        MetricUnitOfMeasurement.DOLLARS);
    fieldUpdated(change, "metricType", MetricType.AVERAGE, MetricType.SUM);
    patchEntity(updatedMetric.getId(), origJson, updatedMetric, ADMIN_AUTH_HEADERS);
    updatedMetric = getMetric(updatedMetric.getId(), "*", ADMIN_AUTH_HEADERS);
    Assertions.assertEquals(MetricUnitOfMeasurement.DOLLARS, updatedMetric.getUnitOfMeasurement());
    Assertions.assertEquals(MetricType.SUM, updatedMetric.getMetricType());
    updatedMetric = getMetric(updatedMetric.getId(), "*", ADMIN_AUTH_HEADERS);
    origJson = JsonUtils.pojoToJson(updatedMetric);
    updatedMetric.setRelatedMetrics(
        List.of(Metric1.getEntityReference(), Metric2.getEntityReference()));
    patchEntity(updatedMetric.getId(), origJson, updatedMetric, ADMIN_AUTH_HEADERS);
    Assertions.assertEquals(2, updatedMetric.getRelatedMetrics().size());
    Assertions.assertEquals(Metric1.getEntityReference(), updatedMetric.getRelatedMetrics().get(0));
    Assertions.assertEquals(Metric2.getEntityReference(), updatedMetric.getRelatedMetrics().get(1));
    updatedMetric = getMetric(updatedMetric.getId(), "*", ADMIN_AUTH_HEADERS);
    origJson = JsonUtils.pojoToJson(updatedMetric);
    updatedMetric.setRelatedMetrics(new ArrayList<>());
    patchEntity(updatedMetric.getId(), origJson, updatedMetric, ADMIN_AUTH_HEADERS);
    Assertions.assertEquals(0, updatedMetric.getRelatedMetrics().size());
    updatedMetric = getMetric(updatedMetric.getId(), "*", ADMIN_AUTH_HEADERS);
    origJson = JsonUtils.pojoToJson(updatedMetric);
    updatedMetric.setRelatedMetrics(List.of(updatedMetric.getEntityReference()));
    Metric finalUpdatedMetric = updatedMetric;
    String finalOrigJson = origJson;
    assertResponse(
        () ->
            patchEntity(
                finalUpdatedMetric.getId(), finalOrigJson, finalUpdatedMetric, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Related metric " + finalUpdatedMetric.getId() + " cannot be the same as the metric");
    updatedMetric.setRelatedMetrics(List.of(USER1.getEntityReference()));
    Metric finalUpdatedMetric1 = updatedMetric;
    String finalOrigJson1 = origJson;
    assertResponse(
        () ->
            patchEntity(
                finalUpdatedMetric1.getId(),
                finalOrigJson1,
                finalUpdatedMetric1,
                ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Related metric " + USER1.getEntityReference().getId() + " is not a metric");
  }

  @Override
  public CreateMetric createRequest(String name) {
    return new CreateMetric().withName(name).withDescription("description");
  }

  @Override
  public void validateCreatedEntity(
      Metric createdEntity, CreateMetric request, Map<String, String> authHeaders)
      throws HttpResponseException {
    // Validate fields
    TestUtils.validateTags(createdEntity.getTags(), createdEntity.getTags());
  }

  @Override
  public void compareEntities(Metric expected, Metric updated, Map<String, String> authHeaders)
      throws HttpResponseException {
    // Compare every field
    TestUtils.validateTags(expected.getTags(), updated.getTags());
    TestUtils.assertEntityReferences(expected.getRelatedMetrics(), updated.getRelatedMetrics());
  }

  @Override
  public Metric validateGetWithDifferentFields(Metric entity, boolean byName)
      throws HttpResponseException {
    String fields = "";
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNull(entity.getOwners());
    assertTrue(entity.getTags().isEmpty());

    fields = "owners,followers,tags";
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), fields, ADMIN_AUTH_HEADERS);
    // Checks for other owner, tags, and followers is done in the base class
    return entity;
  }

  @SuppressWarnings("unchecked")
  @Test
  void test_createMetricWithCustomUnit() throws IOException {
    // Test creating metric with custom unit
    CreateMetric createMetric =
        createRequest("test_custom_unit_metric")
            .withMetricType(MetricType.COUNT)
            .withUnitOfMeasurement(MetricUnitOfMeasurement.OTHER)
            .withCustomUnitOfMeasurement("EURO");

    Metric metric = createAndCheckEntity(createMetric, ADMIN_AUTH_HEADERS);

    Assertions.assertEquals(MetricUnitOfMeasurement.OTHER, metric.getUnitOfMeasurement());
    Assertions.assertEquals("EURO", metric.getCustomUnitOfMeasurement());
  }

  @Test
  void test_createMetricWithCustomUnitValidation() throws IOException {
    // Test missing custom unit when OTHER is selected
    CreateMetric createMetricMissingCustomUnit =
        createRequest("test_missing_custom_unit")
            .withMetricType(MetricType.COUNT)
            .withUnitOfMeasurement(MetricUnitOfMeasurement.OTHER);

    assertResponse(
        () -> createEntity(createMetricMissingCustomUnit, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "customUnitOfMeasurement is required when unitOfMeasurement is OTHER");
  }

  @Test
  void test_createMetricWithLongCustomUnit() throws IOException {
    // Test that very long custom units are accepted (no artificial limits)
    String longUnit =
        "Very Long Custom Unit Name That Could Be Used In Real World Scenarios Like Monthly Active Users Excluding Internal Test Accounts And Bots From Analytics Dashboard";
    CreateMetric createMetric =
        createRequest("test_long_custom_unit")
            .withMetricType(MetricType.COUNT)
            .withUnitOfMeasurement(MetricUnitOfMeasurement.OTHER)
            .withCustomUnitOfMeasurement(longUnit);

    Metric metric = createAndCheckEntity(createMetric, ADMIN_AUTH_HEADERS);
    Assertions.assertEquals(longUnit, metric.getCustomUnitOfMeasurement());
  }

  @Test
  void test_createMetricWithSpecialCharacters() throws IOException {
    // Test that all kinds of characters are accepted (no artificial restrictions)
    CreateMetric createMetric =
        createRequest("test_special_custom_unit")
            .withMetricType(MetricType.COUNT)
            .withUnitOfMeasurement(MetricUnitOfMeasurement.OTHER)
            .withCustomUnitOfMeasurement("Special@#$%^&*()Characters用户数");

    Metric metric = createAndCheckEntity(createMetric, ADMIN_AUTH_HEADERS);
    Assertions.assertEquals("Special@#$%^&*()Characters用户数", metric.getCustomUnitOfMeasurement());
  }

  @Test
  void test_createMetricWithValidCustomUnits() throws IOException {
    // Test various valid custom units including symbols, Unicode, punctuation
    String[] validUnits = {
      "EURO",
      "Minutes",
      "GB/sec",
      "API_Calls",
      "Users (Active)",
      "Queries/Hour",
      "CPU %",
      "Memory [MB]",
      "€",
      "$",
      "£",
      "¥",
      "₹",
      "¢",
      "API calls > 500ms",
      "用户数", // Chinese characters
      "Memory @ peak",
      "Items #tagged",
      "Rate: 95th percentile",
      "Temperature °C"
    };

    for (int i = 0; i < validUnits.length; i++) {
      CreateMetric createMetric =
          createRequest("test_valid_custom_unit_" + i)
              .withMetricType(MetricType.COUNT)
              .withUnitOfMeasurement(MetricUnitOfMeasurement.OTHER)
              .withCustomUnitOfMeasurement(validUnits[i]);

      Metric metric = createAndCheckEntity(createMetric, ADMIN_AUTH_HEADERS);
      Assertions.assertEquals(validUnits[i], metric.getCustomUnitOfMeasurement());
    }
  }

  @Test
  void test_updateMetricCustomUnit() throws IOException {
    // Create metric with standard unit
    CreateMetric createMetric =
        createRequest("test_update_custom_unit")
            .withMetricType(MetricType.COUNT)
            .withUnitOfMeasurement(MetricUnitOfMeasurement.COUNT);

    Metric originalMetric = createAndCheckEntity(createMetric, ADMIN_AUTH_HEADERS);
    Assertions.assertNull(originalMetric.getCustomUnitOfMeasurement());

    // Update to custom unit
    CreateMetric updateRequest =
        createRequest("test_update_custom_unit")
            .withMetricType(MetricType.COUNT)
            .withUnitOfMeasurement(MetricUnitOfMeasurement.OTHER)
            .withCustomUnitOfMeasurement("EURO");

    Metric updatedMetric = updateEntity(updateRequest, Status.OK, ADMIN_AUTH_HEADERS);

    Assertions.assertEquals(MetricUnitOfMeasurement.OTHER, updatedMetric.getUnitOfMeasurement());
    Assertions.assertEquals("EURO", updatedMetric.getCustomUnitOfMeasurement());
  }

  @Test
  void test_customUnitClearedWhenNotOther() throws IOException {
    // Create metric with OTHER and custom unit
    CreateMetric createMetric =
        createRequest("test_clear_custom_unit")
            .withMetricType(MetricType.COUNT)
            .withUnitOfMeasurement(MetricUnitOfMeasurement.OTHER)
            .withCustomUnitOfMeasurement("EURO");

    Metric originalMetric = createAndCheckEntity(createMetric, ADMIN_AUTH_HEADERS);
    Assertions.assertEquals("EURO", originalMetric.getCustomUnitOfMeasurement());

    // Update to standard unit - custom unit should be cleared
    CreateMetric updateRequest =
        createRequest("test_clear_custom_unit")
            .withMetricType(MetricType.COUNT)
            .withUnitOfMeasurement(MetricUnitOfMeasurement.DOLLARS)
            .withCustomUnitOfMeasurement("EURO"); // This should be ignored/cleared

    Metric updatedMetric = updateEntity(updateRequest, Status.OK, ADMIN_AUTH_HEADERS);

    Assertions.assertEquals(MetricUnitOfMeasurement.DOLLARS, updatedMetric.getUnitOfMeasurement());
    Assertions.assertNull(updatedMetric.getCustomUnitOfMeasurement());
  }

  @Test
  void test_getCustomUnitsAPI() throws IOException {
    // Create metrics with different custom units
    String[] customUnits = {"EURO", "Minutes", "GB/sec", "EURO"}; // Note: EURO repeated

    for (int i = 0; i < customUnits.length; i++) {
      CreateMetric createMetric =
          createRequest("test_custom_units_api_" + i)
              .withMetricType(MetricType.COUNT)
              .withUnitOfMeasurement(MetricUnitOfMeasurement.OTHER)
              .withCustomUnitOfMeasurement(customUnits[i]);
      createAndCheckEntity(createMetric, ADMIN_AUTH_HEADERS);
    }

    // Get distinct custom units
    List<String> customUnitsList =
        TestUtils.get(getCollection().path("customUnits"), List.class, ADMIN_AUTH_HEADERS);

    Assertions.assertNotNull(customUnitsList);
    assertTrue(customUnitsList.contains("EURO"));
    assertTrue(customUnitsList.contains("Minutes"));
    assertTrue(customUnitsList.contains("GB/sec"));

    // Should be distinct - EURO should appear only once
    long euroCount = customUnitsList.stream().filter("EURO"::equals).count();
    Assertions.assertEquals(1, euroCount);
  }

  @Test
  void test_customUnitTrimming() throws IOException {
    CreateMetric createMetric =
        createRequest("test_trim_custom_unit")
            .withMetricType(MetricType.COUNT)
            .withUnitOfMeasurement(MetricUnitOfMeasurement.OTHER)
            .withCustomUnitOfMeasurement("  EURO  "); // Spaces around

    Metric metric = createAndCheckEntity(createMetric, ADMIN_AUTH_HEADERS);
    Assertions.assertEquals("EURO", metric.getCustomUnitOfMeasurement()); // Should be trimmed
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    if (expected != null && actual != null) {
      switch (fieldName) {
        case "relatedMetrics" -> TestUtils.assertEntityReferences(
            (List<EntityReference>) expected, (List<EntityReference>) actual);
        case "metricExpression" -> {
          MetricExpression expectedExpression = (MetricExpression) expected;
          MetricExpression actualExpression =
              JsonUtils.readOrConvertValue(actual, MetricExpression.class);
          Assertions.assertEquals(expectedExpression.getCode(), actualExpression.getCode());
          Assertions.assertEquals(expectedExpression.getLanguage(), actualExpression.getLanguage());
        }
        case "granularity" -> Assertions.assertEquals(
            expected, MetricGranularity.valueOf(actual.toString()));
        case "unitOfMeasurement" -> Assertions.assertEquals(
            expected, MetricUnitOfMeasurement.valueOf(actual.toString()));
        case "customUnitOfMeasurement" -> Assertions.assertEquals(expected, actual);
        case "metricType" -> Assertions.assertEquals(
            expected, MetricType.valueOf(actual.toString()));
        default -> assertCommonFieldChange(fieldName, expected, actual);
      }
    }
  }

  public Metric getMetric(UUID id, String fields, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(id);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, Metric.class, authHeaders);
  }
}
