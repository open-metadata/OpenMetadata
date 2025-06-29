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
import java.util.Map;
import java.util.UUID;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.services.CreateStorageService;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.entity.services.connections.TestConnectionResult;
import org.openmetadata.schema.entity.services.connections.TestConnectionResultStatus;
import org.openmetadata.schema.security.credentials.AWSCredentials;
import org.openmetadata.schema.services.connections.storage.S3Connection;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.StorageConnection;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.services.storage.StorageServiceResource;
import org.openmetadata.service.util.TestUtils;

public class StorageServiceResourceTest
    extends ServiceResourceTest<StorageService, CreateStorageService> {
  public StorageServiceResourceTest() {
    super(
        Entity.STORAGE_SERVICE,
        StorageService.class,
        StorageServiceResource.StorageServiceList.class,
        "services/storageServices",
        StorageServiceResource.FIELDS);
    this.supportsPatch = false;
  }

  public void setupStorageService(TestInfo test) throws HttpResponseException {
    StorageServiceResourceTest storageServiceResourceTest = new StorageServiceResourceTest();
    CreateStorageService createStorageService =
        storageServiceResourceTest
            .createRequest(test, 1)
            .withName("s3")
            .withServiceType(CreateStorageService.StorageServiceType.S3)
            .withConnection(TestUtils.S3_STORAGE_CONNECTION);

    StorageService storageService =
        new StorageServiceResourceTest().createEntity(createStorageService, ADMIN_AUTH_HEADERS);
    S3_OBJECT_STORE_SERVICE_REFERENCE = storageService.getEntityReference();
  }

  @Test
  void post_withoutRequiredFields_400_badRequest(TestInfo test) {
    // Create StorageService with mandatory serviceType field empty
    assertResponse(
        () -> createEntity(createRequest(test).withServiceType(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param serviceType must not be null]");
  }

  @Test
  void post_validService_as_admin_200_ok(TestInfo test) throws IOException {
    // Create Storage service with different optional fields
    Map<String, String> authHeaders = ADMIN_AUTH_HEADERS;
    createAndCheckEntity(createRequest(test, 1).withDescription(null), authHeaders);
    createAndCheckEntity(createRequest(test, 2).withDescription("description"), authHeaders);

    createAndCheckEntity(
        createRequest(test, 3).withConnection(TestUtils.S3_STORAGE_CONNECTION), authHeaders);

    // We can create the service without connection
    createAndCheckEntity(createRequest(test).withConnection(null), ADMIN_AUTH_HEADERS);
  }

  @Test
  void put_updateService_as_admin_2xx(TestInfo test) throws IOException {
    AWSCredentials credentials1 =
        new AWSCredentials()
            .withAwsAccessKeyId("ABCD")
            .withAwsSecretAccessKey("1234")
            .withAwsRegion("eu-west-2");
    StorageConnection connection1 =
        new StorageConnection().withConfig(new S3Connection().withAwsConfig(credentials1));
    StorageService service =
        createAndCheckEntity(
            createRequest(test).withDescription(null).withConnection(connection1),
            ADMIN_AUTH_HEADERS);

    AWSCredentials credentials2 =
        new AWSCredentials()
            .withAwsAccessKeyId("DEFG")
            .withAwsSecretAccessKey("5678")
            .withAwsRegion("us-east-1");
    StorageConnection connection2 =
        new StorageConnection().withConfig(new S3Connection().withAwsConfig(credentials2));

    // Update StorageService description and connection

    CreateStorageService update =
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
    StorageService service = createAndCheckEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    // By default, we have no result logged in
    assertNull(service.getTestConnectionResult());
    StorageService updatedService =
        putTestConnectionResult(service.getId(), TEST_CONNECTION_RESULT, ADMIN_AUTH_HEADERS);
    // Validate that the data got properly stored
    assertNotNull(updatedService.getTestConnectionResult());
    assertEquals(
        TestConnectionResultStatus.SUCCESSFUL,
        updatedService.getTestConnectionResult().getStatus());
    assertEquals(updatedService.getConnection(), service.getConnection());
    // Check that the stored data is also correct
    StorageService stored = getEntity(service.getId(), ADMIN_AUTH_HEADERS);
    assertNotNull(stored.getTestConnectionResult());
    assertEquals(
        TestConnectionResultStatus.SUCCESSFUL, stored.getTestConnectionResult().getStatus());
    assertEquals(stored.getConnection(), service.getConnection());
  }

  public StorageService putTestConnectionResult(
      UUID serviceId, TestConnectionResult testConnectionResult, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(serviceId).path("/testConnectionResult");
    return TestUtils.put(target, testConnectionResult, StorageService.class, OK, authHeaders);
  }

  @Override
  public CreateStorageService createRequest(String name) {
    return new CreateStorageService()
        .withName(name)
        .withServiceType(CreateStorageService.StorageServiceType.S3)
        .withConnection(
            new StorageConnection()
                .withConfig(
                    new S3Connection()
                        .withAwsConfig(
                            new AWSCredentials()
                                .withAwsAccessKeyId("ABCD")
                                .withAwsSecretAccessKey("1234")
                                .withAwsRegion("eu-west-2"))));
  }

  @Override
  public void validateCreatedEntity(
      StorageService service, CreateStorageService createRequest, Map<String, String> authHeaders) {
    assertEquals(createRequest.getName(), service.getName());
    StorageConnection expectedConnection = createRequest.getConnection();
    StorageConnection actualConnection = service.getConnection();
    validateConnection(expectedConnection, actualConnection, service.getServiceType());
  }

  @Override
  public void compareEntities(
      StorageService expected, StorageService updated, Map<String, String> authHeaders) {
    // PATCH operation is not supported by this entity
  }

  @Override
  public StorageService validateGetWithDifferentFields(StorageService service, boolean byName)
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
    if (fieldName.equals("connection")) {
      assertTrue(((String) actual).contains("-encrypted-value"));
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }

  private void validateConnection(
      StorageConnection expectedConnection,
      StorageConnection actualConnection,
      CreateStorageService.StorageServiceType serviceType) {
    if (expectedConnection != null && actualConnection != null) {
      if (serviceType == CreateStorageService.StorageServiceType.S3) {
        S3Connection expectedS3Connection = (S3Connection) expectedConnection.getConfig();
        S3Connection actualS3Connection;
        if (actualConnection.getConfig() instanceof S3Connection) {
          actualS3Connection = (S3Connection) actualConnection.getConfig();
        } else {
          actualS3Connection =
              JsonUtils.convertValue(actualConnection.getConfig(), S3Connection.class);
        }
        assertEquals(
            expectedS3Connection.getAwsConfig().getAwsAccessKeyId(),
            actualS3Connection.getAwsConfig().getAwsAccessKeyId());
        assertEquals(
            expectedS3Connection.getAwsConfig().getAwsRegion(),
            actualS3Connection.getAwsConfig().getAwsRegion());
      }
    }
  }
}
