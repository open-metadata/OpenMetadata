package org.openmetadata.service.resources.apis;

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

import java.io.IOException;
import java.net.URI;
import java.util.HashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.data.CreateAPICollection;
import org.openmetadata.schema.entity.data.APICollection;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.ResultList;

@Slf4j
public class APICollectionResourceTest
    extends EntityResourceTest<APICollection, CreateAPICollection> {
  public APICollectionResourceTest() {
    super(
        Entity.API_COLLCECTION,
        APICollection.class,
        APICollectionResource.APICollectionList.class,
        "apiCollections",
        APICollectionResource.FIELDS);
    supportedNameCharacters = "_'+#- .()$" + EntityResourceTest.RANDOM_STRING_GENERATOR.generate(1);
  }

  public void setupAPICollection(TestInfo test) throws HttpResponseException {
    APICollectionResourceTest apiCollectionResourceTest = new APICollectionResourceTest();
    CreateAPICollection createAPICollection =
        apiCollectionResourceTest
            .createRequest(test)
            .withName("users")
            .withEndpointURL(URI.create("https://locahost:8585/api/v1/users"))
            .withService(OPENMETADATA_API_SERVICE_REFERENCE.getFullyQualifiedName());

    APICollection omAPICollection =
        new APICollectionResourceTest().createEntity(createAPICollection, ADMIN_AUTH_HEADERS);
    OPENMETADATA_API_COLLECTION_REFERENCE = omAPICollection.getEntityReference();

    createAPICollection =
        apiCollectionResourceTest
            .createRequest(test)
            .withName("sample")
            .withEndpointURL(URI.create("https://locahost:8585/api/v1/sample"))
            .withService(OPENMETADATA_API_SERVICE_REFERENCE.getFullyQualifiedName());

    APICollection sampleAPICollection =
        new APICollectionResourceTest().createEntity(createAPICollection, ADMIN_AUTH_HEADERS);
    SAMPLE_API_COLLECTION_REFERENCE = sampleAPICollection.getEntityReference();
  }

  @Test
  void post_apiCollectionFQN_as_admin_200_OK(TestInfo test) throws IOException {
    // Create API Collection with different optional fields
    CreateAPICollection create =
        createRequest(test).withService(OPENMETADATA_API_SERVICE_REFERENCE.getFullyQualifiedName());
    APICollection apiCollection = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    String expectedFQN =
        FullyQualifiedName.build(
            OPENMETADATA_API_SERVICE_REFERENCE.getFullyQualifiedName(), create.getName());
    assertEquals(expectedFQN, apiCollection.getFullyQualifiedName());
  }

  @Test
  void post_APICollectionWithoutRequiredService_4xx(TestInfo test) {
    CreateAPICollection create = createRequest(test).withService(null);
    assertResponseContains(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "query param service must not be null");
  }

  @Test
  void post_apiCollectionWithDifferentService_200_ok(TestInfo test) throws IOException {
    EntityReference[] differentServices = {
      OPENMETADATA_API_SERVICE_REFERENCE, SAMPLE_API_SERVICE_REFERENCE
    };

    // Create APICollection for each service and test APIs
    for (EntityReference service : differentServices) {
      createAndCheckEntity(
          createRequest(test).withService(service.getFullyQualifiedName()), ADMIN_AUTH_HEADERS);

      // List APICollection by filtering on service name and ensure right APICollection in the
      // response
      Map<String, String> queryParams = new HashMap<>();
      queryParams.put("service", service.getName());

      ResultList<APICollection> list = listEntities(queryParams, ADMIN_AUTH_HEADERS);
      for (APICollection apiCollection : list.getData()) {
        assertEquals(service.getName(), apiCollection.getService().getName());
      }
    }
  }

  @Override
  public APICollection validateGetWithDifferentFields(APICollection apiCollection, boolean byName)
      throws HttpResponseException {
    String fields = "";
    apiCollection =
        byName
            ? getEntityByName(apiCollection.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(apiCollection.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(apiCollection.getService(), apiCollection.getServiceType());

    fields = "owners,tags";
    apiCollection =
        byName
            ? getEntityByName(apiCollection.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(apiCollection.getId(), fields, ADMIN_AUTH_HEADERS);

    assertListNotNull(apiCollection.getService(), apiCollection.getServiceType());
    // Checks for other owner, tags, and followers is done in the base class
    return apiCollection;
  }

  @Override
  public CreateAPICollection createRequest(String name) {
    return new CreateAPICollection()
        .withName(name)
        .withService(getContainer().getFullyQualifiedName());
  }

  @Override
  public EntityReference getContainer() {
    return OPENMETADATA_API_SERVICE_REFERENCE;
  }

  @Override
  public EntityReference getContainer(APICollection entity) {
    return entity.getService();
  }

  @Override
  public void validateCreatedEntity(
      APICollection apiCollection,
      CreateAPICollection createRequest,
      Map<String, String> authHeaders) {
    // Validate service
    assertNotNull(apiCollection.getServiceType());
    assertReference(createRequest.getService(), apiCollection.getService());
    assertEquals(
        FullyQualifiedName.build(apiCollection.getService().getName(), apiCollection.getName()),
        apiCollection.getFullyQualifiedName());
  }

  @Override
  public void compareEntities(
      APICollection expected, APICollection updated, Map<String, String> authHeaders) {
    assertReference(expected.getService(), updated.getService());
    assertEquals(
        FullyQualifiedName.build(updated.getService().getName(), updated.getName()),
        updated.getFullyQualifiedName());
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    assertCommonFieldChange(fieldName, expected, actual);
  }
}
