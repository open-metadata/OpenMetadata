/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.resources.services;

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static jakarta.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.resources.EntityResourceTest.GOOGLE_DRIVE_SERVICE_REFERENCE;
import static org.openmetadata.service.resources.EntityResourceTest.SHAREPOINT_DRIVE_SERVICE_REFERENCE;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.INGESTION_BOT_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.TEST_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import jakarta.ws.rs.client.WebTarget;
import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.services.CreateDriveService;
import org.openmetadata.schema.api.services.CreateDriveService.DriveServiceType;
import org.openmetadata.schema.entity.services.DriveService;
import org.openmetadata.schema.entity.services.connections.TestConnectionResult;
import org.openmetadata.schema.entity.services.connections.TestConnectionResultStatus;
import org.openmetadata.schema.security.credentials.GCPCredentials;
import org.openmetadata.schema.security.credentials.GCPValues;
import org.openmetadata.schema.services.connections.drive.GoogleDriveConnection;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.DriveConnection;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.TestUtils;

@Slf4j
public class DriveServiceResourceTest
    extends ServiceResourceTest<DriveService, CreateDriveService> {

  public DriveServiceResourceTest() {
    super(
        Entity.DRIVE_SERVICE,
        DriveService.class,
        DriveServiceResource.DriveServiceList.class,
        "services/driveServices",
        DriveServiceResource.FIELDS);
    this.supportsPatch = false;
  }

  @Test
  void post_validDriveService_as_admin_200_ok(TestInfo test) throws IOException {
    // Create drive service with different optional fields
    Map<String, String> authHeaders = ADMIN_AUTH_HEADERS;

    // Create service without description
    DriveService service1 =
        createAndCheckEntity(createRequest(test, 1).withDescription(null), authHeaders);
    assertNotNull(service1);
    assertNotNull(service1.getId());
    assertNotNull(service1.getName());
    assertNull(service1.getDescription());
    assertEquals(CreateDriveService.DriveServiceType.GoogleDrive, service1.getServiceType());
    assertNotNull(service1.getConnection());

    // Create service with description
    DriveService service2 =
        createAndCheckEntity(createRequest(test, 2).withDescription("description"), authHeaders);
    assertNotNull(service2);
    assertNotNull(service2.getId());
    assertNotNull(service2.getName());
    assertEquals("description", service2.getDescription());
    assertEquals(CreateDriveService.DriveServiceType.GoogleDrive, service2.getServiceType());

    // We can create the service without connection
    DriveService service3 =
        createAndCheckEntity(createRequest(test).withConnection(null), ADMIN_AUTH_HEADERS);
    assertNotNull(service3);
    assertNull(service3.getConnection());
    assertEquals(CreateDriveService.DriveServiceType.GoogleDrive, service3.getServiceType());
  }

  @Test
  void post_withoutRequiredFields_400_badRequest(TestInfo test) {
    // Create DriveService with mandatory serviceType field empty
    assertResponse(
        () -> createEntity(createRequest(test).withServiceType(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param serviceType must not be null]");
  }

  @Test
  void put_updateDriveService_as_admin_2xx(TestInfo test) throws IOException {
    DriveService service =
        createAndCheckEntity(createRequest(test).withDescription(null), ADMIN_AUTH_HEADERS);

    // Update drive description that is null
    CreateDriveService update =
        createRequest(test).withDescription("description1").withName(service.getName());

    ChangeDescription change = getChangeDescription(service, MINOR_UPDATE);
    fieldAdded(change, "description", "description1");
    updateAndCheckEntity(update, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Add Google Drive connection
    GCPCredentials gcpCredentials =
        new GCPCredentials()
            .withGcpConfig(
                new GCPValues()
                    .withType("service_account")
                    .withProjectId("test-project-id")
                    .withPrivateKeyId("test-private-key-id")
                    .withPrivateKey("test-private-key")
                    .withClientEmail("test@test-project.iam.gserviceaccount.com")
                    .withClientId("123456789"));

    GoogleDriveConnection googleDriveConnection =
        new GoogleDriveConnection().withDriveId("test-drive-id").withCredentials(gcpCredentials);
    DriveConnection driveConnection = new DriveConnection().withConfig(googleDriveConnection);
    update.withConnection(driveConnection);
    service = updateEntity(update, OK, ADMIN_AUTH_HEADERS);
    validateDriveConnection(
        driveConnection, service.getConnection(), service.getServiceType(), true);

    // Get the recently updated entity and verify the changes
    service = getEntity(service.getId(), ADMIN_AUTH_HEADERS);
    validateDriveConnection(
        driveConnection, service.getConnection(), service.getServiceType(), true);
    assertEquals("description1", service.getDescription());

    // non admin/bot user, secret fields must be masked
    DriveService newService = getEntity(service.getId(), "*", TEST_AUTH_HEADERS);
    assertEquals(newService.getName(), service.getName());
    validateDriveConnection(
        driveConnection, newService.getConnection(), newService.getServiceType(), true);

    // bot user, secret fields must be unmasked.
    service = getEntity(service.getId(), INGESTION_BOT_AUTH_HEADERS);
    validateDriveConnection(
        driveConnection, service.getConnection(), service.getServiceType(), false);
  }

  @Test
  void put_testConnectionResult_200(TestInfo test) throws IOException {
    DriveService service = createAndCheckEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    // By default, we have no result logged in
    assertNull(service.getTestConnectionResult());

    TestConnectionResult testConnectionResult =
        new TestConnectionResult()
            .withStatus(TestConnectionResultStatus.SUCCESSFUL)
            .withLastUpdatedAt(System.currentTimeMillis());

    DriveService updatedService =
        putTestConnectionResult(service.getId(), testConnectionResult, ADMIN_AUTH_HEADERS);
    // Validate that the data got properly stored
    assertNotNull(updatedService.getTestConnectionResult());
    assertEquals(
        TestConnectionResultStatus.SUCCESSFUL,
        updatedService.getTestConnectionResult().getStatus());
    assertEquals(updatedService.getConnection(), service.getConnection());

    // Check that the stored data is also correct
    DriveService stored = getEntity(service.getId(), ADMIN_AUTH_HEADERS);
    assertNotNull(stored.getTestConnectionResult());
    assertEquals(
        TestConnectionResultStatus.SUCCESSFUL, stored.getTestConnectionResult().getStatus());
    assertEquals(stored.getConnection(), service.getConnection());
  }

  public DriveService putTestConnectionResult(
      UUID serviceId, TestConnectionResult testConnectionResult, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(serviceId).path("/testConnectionResult");
    return TestUtils.put(target, testConnectionResult, DriveService.class, OK, authHeaders);
  }

  @Override
  public CreateDriveService createRequest(String name) {
    return new CreateDriveService()
        .withName(name)
        .withServiceType(DriveServiceType.GoogleDrive)
        .withConnection(getGoogleDriveConnection());
  }

  @Override
  public void validateCreatedEntity(
      DriveService service, CreateDriveService createRequest, Map<String, String> authHeaders) {
    assertEquals(createRequest.getName(), service.getName());
    boolean maskSecrets = !INGESTION_BOT_AUTH_HEADERS.equals(authHeaders);
    validateDriveConnection(
        createRequest.getConnection(),
        service.getConnection(),
        service.getServiceType(),
        maskSecrets);
  }

  @Override
  public void compareEntities(
      DriveService expected, DriveService updated, Map<String, String> authHeaders) {
    // PATCH operation is not supported by this entity
  }

  @Override
  public DriveService validateGetWithDifferentFields(DriveService service, boolean byName)
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
    // Checks for other owners, tags is done in the base class
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

  private DriveConnection getGoogleDriveConnection() {
    // Create test GCP credentials with proper structure
    GCPCredentials gcpCredentials =
        new GCPCredentials()
            .withGcpConfig(
                new GCPValues()
                    .withType("service_account")
                    .withProjectId("test-project-id")
                    .withPrivateKeyId("test-private-key-id")
                    .withPrivateKey("test-private-key")
                    .withClientEmail("test@test-project.iam.gserviceaccount.com")
                    .withClientId("123456789"));

    GoogleDriveConnection googleDriveConnection =
        new GoogleDriveConnection()
            .withDriveId("test-drive-id")
            .withCredentials(gcpCredentials)
            .withIncludeGoogleSheets(true);
    return new DriveConnection().withConfig(googleDriveConnection);
  }

  private void validateDriveConnection(
      DriveConnection expectedConnection,
      DriveConnection actualConnection,
      DriveServiceType serviceType,
      boolean maskSecrets) {
    if (expectedConnection != null && actualConnection != null) {
      if (serviceType == DriveServiceType.GoogleDrive) {
        GoogleDriveConnection expected = (GoogleDriveConnection) expectedConnection.getConfig();
        GoogleDriveConnection actual;
        if (actualConnection.getConfig() instanceof GoogleDriveConnection) {
          actual = (GoogleDriveConnection) actualConnection.getConfig();
        } else {
          actual =
              JsonUtils.convertValue(actualConnection.getConfig(), GoogleDriveConnection.class);
        }
        assertEquals(expected.getDriveId(), actual.getDriveId());
      }
    }
  }

  public void setupDriveServices(TestInfo test) throws HttpResponseException {
    // Create Google Drive service
    CreateDriveService createGoogleDrive =
        createRequest(test)
            .withName("googleDriveTest")
            .withServiceType(CreateDriveService.DriveServiceType.GoogleDrive)
            .withConnection(getGoogleDriveConnection());
    DriveService googleDrive;
    try {
      googleDrive = getEntityByName(createGoogleDrive.getName(), ADMIN_AUTH_HEADERS);
    } catch (Exception e) {
      // Service doesn't exist, create it
      googleDrive = createEntity(createGoogleDrive, ADMIN_AUTH_HEADERS);
    }
    GOOGLE_DRIVE_SERVICE_REFERENCE = googleDrive.getEntityReference();

    // TODO: Create SharePoint service after regenerating code with SharePointConnection
    // For now, set SharePoint reference to the same as Google Drive for testing
    SHAREPOINT_DRIVE_SERVICE_REFERENCE = googleDrive.getEntityReference();
  }
}
