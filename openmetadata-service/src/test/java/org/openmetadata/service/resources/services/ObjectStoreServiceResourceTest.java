package org.openmetadata.service.resources.services;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import javax.ws.rs.client.WebTarget;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.services.CreateObjectStoreService;
import org.openmetadata.schema.api.services.CreateObjectStoreService.ObjectStoreServiceType;
import org.openmetadata.schema.entity.services.ObjectStoreService;
import org.openmetadata.schema.entity.services.connections.TestConnectionResult;
import org.openmetadata.schema.entity.services.connections.TestConnectionResultStatus;
import org.openmetadata.schema.security.credentials.AWSCredentials;
import org.openmetadata.schema.services.connections.objectstore.S3Connection;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ObjectStoreConnection;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.services.objectstore.ObjectStoreServiceResource;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.TestUtils;

public class ObjectStoreServiceResourceTest extends EntityResourceTest<ObjectStoreService, CreateObjectStoreService> {
  public ObjectStoreServiceResourceTest() {
    super(
        Entity.OBJECT_STORE_SERVICE,
        ObjectStoreService.class,
        ObjectStoreServiceResource.ObjectStoreServiceList.class,
        "services/objectStoreServices",
        "owner");
    this.supportsPatch = false;
  }

  public void setupObjectStoreService(TestInfo test) throws HttpResponseException {
    ObjectStoreServiceResourceTest objectStoreServiceResourceTest = new ObjectStoreServiceResourceTest();
    CreateObjectStoreService createObjectStoreService =
        objectStoreServiceResourceTest
            .createRequest(test, 1)
            .withName("s3")
            .withServiceType(ObjectStoreServiceType.S3)
            .withConnection(TestUtils.OBJECT_STORE_CONNECTION);

    ObjectStoreService objectStoreService =
        new ObjectStoreServiceResourceTest().createEntity(createObjectStoreService, ADMIN_AUTH_HEADERS);
    S3_OBJECT_STORE_SERVICE_REFERENCE = objectStoreService.getEntityReference();
  }

  @Test
  void post_withoutRequiredFields_400_badRequest(TestInfo test) {
    // Create ObjectStoreService with mandatory serviceType field empty
    assertResponse(
        () -> createEntity(createRequest(test).withServiceType(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[serviceType must not be null]");

    // Create ObjectStoreService with mandatory connection field empty
    assertResponse(
        () -> createEntity(createRequest(test).withConnection(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[connection must not be null]");
  }

  @Test
  void post_validService_as_admin_200_ok(TestInfo test) throws IOException {
    // Create ObjectStore service with different optional fields
    Map<String, String> authHeaders = ADMIN_AUTH_HEADERS;
    createAndCheckEntity(createRequest(test, 1).withDescription(null), authHeaders);
    createAndCheckEntity(createRequest(test, 2).withDescription("description"), authHeaders);

    createAndCheckEntity(createRequest(test, 3).withConnection(TestUtils.OBJECT_STORE_CONNECTION), authHeaders);
  }

  @Test
  void put_updateService_as_admin_2xx(TestInfo test) throws IOException {
    AWSCredentials credentials1 =
        new AWSCredentials().withAwsAccessKeyId("ABCD").withAwsSecretAccessKey("1234").withAwsRegion("eu-west-2");
    ObjectStoreConnection connection1 =
        new ObjectStoreConnection().withConfig(new S3Connection().withAwsConfig(credentials1));
    ObjectStoreService service =
        createAndCheckEntity(createRequest(test).withDescription(null).withConnection(connection1), ADMIN_AUTH_HEADERS);

    AWSCredentials credentials2 =
        new AWSCredentials().withAwsAccessKeyId("DEFG").withAwsSecretAccessKey("5678").withAwsRegion("us-east-1");
    ObjectStoreConnection connection2 =
        new ObjectStoreConnection().withConfig(new S3Connection().withAwsConfig(credentials2));

    // Update ObjectStoreService description and connection

    CreateObjectStoreService update = createRequest(test).withDescription("description1").withConnection(connection2);

    ChangeDescription change = getChangeDescription(service.getVersion());
    fieldAdded(change, "description", "description1");
    fieldUpdated(change, "connection", connection1, connection2);
    updateAndCheckEntity(update, OK, ADMIN_AUTH_HEADERS, TestUtils.UpdateType.MINOR_UPDATE, change);
  }

  @Test
  void put_testConnectionResult_200(TestInfo test) throws IOException {
    ObjectStoreService service = createAndCheckEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    // By default, we have no result logged in
    assertNull(service.getTestConnectionResult());
    ObjectStoreService updatedService =
        putTestConnectionResult(service.getId(), TEST_CONNECTION_RESULT, ADMIN_AUTH_HEADERS);
    // Validate that the data got properly stored
    assertNotNull(updatedService.getTestConnectionResult());
    assertEquals(updatedService.getTestConnectionResult().getStatus(), TestConnectionResultStatus.SUCCESSFUL);
    assertEquals(updatedService.getConnection(), service.getConnection());
    // Check that the stored data is also correct
    ObjectStoreService stored = getEntity(service.getId(), ADMIN_AUTH_HEADERS);
    assertNotNull(stored.getTestConnectionResult());
    assertEquals(stored.getTestConnectionResult().getStatus(), TestConnectionResultStatus.SUCCESSFUL);
    assertEquals(stored.getConnection(), service.getConnection());
  }

  public ObjectStoreService putTestConnectionResult(
      UUID serviceId, TestConnectionResult testConnectionResult, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(serviceId).path("/testConnectionResult");
    return TestUtils.put(target, testConnectionResult, ObjectStoreService.class, OK, authHeaders);
  }

  @Override
  public CreateObjectStoreService createRequest(String name) {
    return new CreateObjectStoreService()
        .withName(name)
        .withServiceType(ObjectStoreServiceType.S3)
        .withConnection(
            new ObjectStoreConnection()
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
      ObjectStoreService service, CreateObjectStoreService createRequest, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertEquals(service.getName(), service.getName());
    ObjectStoreConnection expectedConnection = createRequest.getConnection();
    ObjectStoreConnection actualConnection = service.getConnection();
    validateConnection(expectedConnection, actualConnection, service.getServiceType());
  }

  @Override
  public void compareEntities(ObjectStoreService expected, ObjectStoreService updated, Map<String, String> authHeaders)
      throws HttpResponseException {
    // PATCH operation is not supported by this entity

  }

  @Override
  public ObjectStoreService validateGetWithDifferentFields(ObjectStoreService service, boolean byName)
      throws HttpResponseException {
    String fields = "";
    service =
        byName
            ? getEntityByName(service.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(service.getId(), fields, ADMIN_AUTH_HEADERS);
    TestUtils.assertListNull(service.getOwner());

    fields = "owner,tags";
    service =
        byName
            ? getEntityByName(service.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(service.getId(), fields, ADMIN_AUTH_HEADERS);
    // Checks for other owner, tags, and followers is done in the base class
    return service;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (fieldName.equals("connection")) {
      assertTrue(((String) actual).contains("-encrypted-value"));
    } else {
      super.assertCommonFieldChange(fieldName, expected, actual);
    }
  }

  private void validateConnection(
      ObjectStoreConnection expectedConnection,
      ObjectStoreConnection actualConnection,
      ObjectStoreServiceType serviceType) {
    if (expectedConnection != null && actualConnection != null) {
      if (serviceType == ObjectStoreServiceType.S3) {
        S3Connection expectedS3Connection = (S3Connection) expectedConnection.getConfig();
        S3Connection actualS3Connection;
        if (actualConnection.getConfig() instanceof S3Connection) {
          actualS3Connection = (S3Connection) actualConnection.getConfig();
        } else {
          actualS3Connection = JsonUtils.convertValue(actualConnection.getConfig(), S3Connection.class);
        }
        assertEquals(
            expectedS3Connection.getAwsConfig().getAwsAccessKeyId(),
            actualS3Connection.getAwsConfig().getAwsAccessKeyId());
        assertTrue(actualS3Connection.getAwsConfig().getAwsSecretAccessKey().contains("secret")); // encrypted
        assertEquals(
            expectedS3Connection.getAwsConfig().getAwsRegion(), actualS3Connection.getAwsConfig().getAwsRegion());
      }
    }
  }
}
