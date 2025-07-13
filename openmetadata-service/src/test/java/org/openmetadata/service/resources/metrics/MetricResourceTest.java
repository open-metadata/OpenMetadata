package org.openmetadata.service.resources.metrics;

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
