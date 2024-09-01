package org.openmetadata.service.resources.metrics;

import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertListNull;

import java.io.IOException;
import java.util.Map;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.schema.api.data.CreateMetric;
import org.openmetadata.schema.entity.data.Metric;
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
    assertListNull(entity.getOwners(), entity.getTags());

    fields = "owners,tags";
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), fields, ADMIN_AUTH_HEADERS);
    // Checks for other owner, tags, and followers is done in the base class
    return entity;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual)
      throws IOException {
    assertCommonFieldChange(fieldName, expected, actual);
  }
}
