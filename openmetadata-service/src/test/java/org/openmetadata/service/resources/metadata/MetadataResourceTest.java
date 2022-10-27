package org.openmetadata.service.resources.metadata;

import static javax.ws.rs.core.Response.Status.*;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

import java.io.IOException;
import java.util.Map;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.metadata.CreateMetadata;
import org.openmetadata.schema.entity.metadata.Metadata;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;

public class MetadataResourceTest extends EntityResourceTest<Metadata, CreateMetadata> {
  public MetadataResourceTest() {
    super(Entity.METADATA, Metadata.class, MetadataResource.MetadataList.class, "metadata", MetadataResource.FIELDS);
    supportsEmptyDescription = false;
    supportsFollowers = false;
    supportsAuthorizedMetadataOperations = false;
    supportsOwner = false;
  }

  @Test
  void post_metadata_entity_200(TestInfo test) throws IOException {
    CreateMetadata create = createRequest(test);
    create.withName("bar");
    Metadata metadata = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    metadata = getEntity(metadata.getId(), ADMIN_AUTH_HEADERS);
    validateCreatedEntity(metadata, create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_metadata_4x(TestInfo test) throws IOException {
    assertResponseContains(
        () -> createEntity(createRequest(test).withName(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "name must not be null");
  }

  @Override
  public CreateMetadata createRequest(String name) {
    return new CreateMetadata().withName(name).withDescription(name);
  }

  @Override
  public void validateCreatedEntity(Metadata createdEntity, CreateMetadata request, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertEquals(request.getName(), createdEntity.getName());
    assertEquals(request.getDescription(), createdEntity.getDescription());
  }

  @Override
  public void compareEntities(Metadata expected, Metadata updated, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertEquals(expected.getName(), updated.getName());
    assertEquals(expected.getFullyQualifiedName(), updated.getFullyQualifiedName());
    assertEquals(expected.getDescription(), updated.getDescription());
  }

  @Override
  public Metadata validateGetWithDifferentFields(Metadata entity, boolean byName) throws HttpResponseException {
    return null;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    return;
  }
}
