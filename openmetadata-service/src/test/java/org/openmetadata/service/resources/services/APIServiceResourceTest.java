package org.openmetadata.service.resources.services;

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static jakarta.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import jakarta.ws.rs.client.WebTarget;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Map;
import java.util.UUID;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.services.CreateApiService;
import org.openmetadata.schema.entity.services.ApiService;
import org.openmetadata.schema.entity.services.connections.TestConnectionResult;
import org.openmetadata.schema.entity.services.connections.TestConnectionResultStatus;
import org.openmetadata.schema.services.connections.api.RestConnection;
import org.openmetadata.schema.type.ApiConnection;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.services.apiservices.APIServiceResource;
import org.openmetadata.service.util.TestUtils;

public class APIServiceResourceTest extends ServiceResourceTest<ApiService, CreateApiService> {
  public APIServiceResourceTest() {
    super(
        Entity.API_SERVICE,
        ApiService.class,
        APIServiceResource.APIServiceList.class,
        "services/apiServices",
        APIServiceResource.FIELDS);
    this.supportsPatch = false;
  }

  public void setupAPIService(TestInfo test) throws HttpResponseException {
    APIServiceResourceTest apiServiceResourceTest = new APIServiceResourceTest();
    CreateApiService createApiService =
        apiServiceResourceTest
            .createRequest(test)
            .withName("openmetadata")
            .withServiceType(CreateApiService.ApiServiceType.Rest)
            .withConnection(TestUtils.API_SERVICE_CONNECTION);

    ApiService omAPIService =
        new APIServiceResourceTest().createEntity(createApiService, ADMIN_AUTH_HEADERS);
    OPENMETADATA_API_SERVICE_REFERENCE = omAPIService.getEntityReference();
    APIServiceResourceTest sampleAPIServiceResourceTest = new APIServiceResourceTest();
    createApiService =
        sampleAPIServiceResourceTest
            .createRequest(test)
            .withName("sampleAPI")
            .withServiceType(CreateApiService.ApiServiceType.Rest)
            .withConnection(TestUtils.API_SERVICE_CONNECTION);
    ApiService sampleAPIService =
        new APIServiceResourceTest().createEntity(createApiService, ADMIN_AUTH_HEADERS);
    SAMPLE_API_SERVICE_REFERENCE = sampleAPIService.getEntityReference();
  }

  @Test
  void post_withoutRequiredFields_400_badRequest(TestInfo test) {
    // Create APIService with mandatory serviceType field empty
    assertResponse(
        () -> createEntity(createRequest(test).withServiceType(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param serviceType must not be null]");
  }

  @Test
  void post_validService_as_admin_200_ok(TestInfo test) throws IOException {
    // Create API service with different optional fields
    Map<String, String> authHeaders = ADMIN_AUTH_HEADERS;
    createAndCheckEntity(createRequest(test, 1).withDescription(null), authHeaders);
    createAndCheckEntity(createRequest(test, 2).withDescription("description"), authHeaders);
    createAndCheckEntity(
        createRequest(test, 3).withConnection(TestUtils.API_SERVICE_CONNECTION), authHeaders);

    // We can create the service without connection
    createAndCheckEntity(createRequest(test).withConnection(null), ADMIN_AUTH_HEADERS);
  }

  @Test
  void put_updateService_as_admin_2xx(TestInfo test) throws IOException, URISyntaxException {
    ApiConnection connection1 =
        new ApiConnection()
            .withConfig(
                new RestConnection()
                    .withOpenAPISchemaURL(
                        new URI("http://sandbox.open-metadata.org/swagger.json")));
    ApiService service =
        createAndCheckEntity(
            createRequest(test).withDescription(null).withConnection(connection1),
            ADMIN_AUTH_HEADERS);

    RestConnection credentials2 =
        new RestConnection()
            .withOpenAPISchemaURL(new URI("https://localhost:9400"))
            .withToken("test");
    ApiConnection connection2 = new ApiConnection().withConfig(credentials2);

    // Update APIService description and connection

    CreateApiService update =
        createRequest(test)
            .withDescription("description1")
            .withConnection(connection2)
            .withName(service.getName());

    ChangeDescription change = getChangeDescription(service, MINOR_UPDATE);
    fieldAdded(change, "description", "description1");
    fieldUpdated(change, "connection", connection1, connection2);
    updateAndCheckEntity(update, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void put_testConnectionResult_200(TestInfo test) throws IOException {
    ApiService service = createAndCheckEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    // By default, we have no result logged in
    assertNull(service.getTestConnectionResult());
    ApiService updatedService =
        putTestConnectionResult(service.getId(), TEST_CONNECTION_RESULT, ADMIN_AUTH_HEADERS);
    // Validate that the data got properly stored
    assertNotNull(updatedService.getTestConnectionResult());
    assertEquals(
        TestConnectionResultStatus.SUCCESSFUL,
        updatedService.getTestConnectionResult().getStatus());
    assertEquals(updatedService.getConnection(), service.getConnection());
    // Check that the stored data is also correct
    ApiService stored = getEntity(service.getId(), ADMIN_AUTH_HEADERS);
    assertNotNull(stored.getTestConnectionResult());
    assertEquals(
        TestConnectionResultStatus.SUCCESSFUL, stored.getTestConnectionResult().getStatus());
    assertEquals(stored.getConnection(), service.getConnection());
  }

  public ApiService putTestConnectionResult(
      UUID serviceId, TestConnectionResult testConnectionResult, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(serviceId).path("/testConnectionResult");
    return TestUtils.put(target, testConnectionResult, ApiService.class, OK, authHeaders);
  }

  @Override
  public CreateApiService createRequest(String name) {
    return new CreateApiService()
        .withName(name)
        .withServiceType(CreateApiService.ApiServiceType.Rest)
        .withConnection(
            new ApiConnection()
                .withConfig(
                    new RestConnection()
                        .withOpenAPISchemaURL(
                            CommonUtil.getUri("http://localhost:8585/swagger.json"))));
  }

  @Override
  public void validateCreatedEntity(
      ApiService service, CreateApiService createRequest, Map<String, String> authHeaders) {
    assertEquals(createRequest.getName(), service.getName());
    ApiConnection expectedConnection = createRequest.getConnection();
    ApiConnection actualConnection = service.getConnection();
    validateConnection(expectedConnection, actualConnection, service.getServiceType());
  }

  @Override
  public void compareEntities(
      ApiService expected, ApiService updated, Map<String, String> authHeaders) {
    // PATCH operation is not supported by this entity
  }

  @Override
  public ApiService validateGetWithDifferentFields(ApiService service, boolean byName)
      throws HttpResponseException {
    String fields = "";
    service =
        byName
            ? getEntityByName(service.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(service.getId(), fields, ADMIN_AUTH_HEADERS);
    TestUtils.assertListNull(service.getOwners());

    fields = "owners,tags,followers";
    service =
        byName
            ? getEntityByName(service.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(service.getId(), fields, ADMIN_AUTH_HEADERS);
    // Checks for other owners, tags, and followers is done in the base class
    return service;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    if (expected == actual) {
      return;
    }
    if (fieldName.equals("connection")) {
      assertTrue(((String) actual).contains("-encrypted-value"));
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }

  private void validateConnection(
      ApiConnection expectedConnection,
      ApiConnection actualConnection,
      CreateApiService.ApiServiceType serviceType) {
    if (expectedConnection != null && actualConnection != null) {
      RestConnection restConnection = (RestConnection) expectedConnection.getConfig();
      RestConnection actualESConnection =
          JsonUtils.convertValue(actualConnection.getConfig(), RestConnection.class);
      assertEquals(restConnection.getOpenAPISchemaURL(), actualESConnection.getOpenAPISchemaURL());
    }
  }
}
