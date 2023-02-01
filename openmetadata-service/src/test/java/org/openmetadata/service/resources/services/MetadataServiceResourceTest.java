package org.openmetadata.service.resources.services;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.AMUNDSEN_CONNECTION;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.services.CreateMetadataService;
import org.openmetadata.schema.entity.services.MetadataConnection;
import org.openmetadata.schema.entity.services.MetadataService;
import org.openmetadata.schema.services.connections.metadata.AmundsenConnection;
import org.openmetadata.schema.services.connections.metadata.AtlasConnection;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.services.metadata.MetadataServiceResource;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ParallelizeTest;
import org.openmetadata.service.util.TestUtils;

@Slf4j
@ParallelizeTest
public class MetadataServiceResourceTest extends EntityResourceTest<MetadataService, CreateMetadataService> {
  public MetadataServiceResourceTest() {
    super(
        Entity.METADATA_SERVICE,
        MetadataService.class,
        MetadataServiceResource.MetadataServiceList.class,
        "services/metadataServices",
        MetadataServiceResource.FIELDS);
    supportsPatch = false;
  }

  public void setupMetadataServices() throws HttpResponseException {
    // Create Amundsen service
    MetadataServiceResourceTest metadataServiceResourceTest = new MetadataServiceResourceTest();
    CreateMetadataService createMetadata =
        new CreateMetadataService()
            .withName("amundsen")
            .withServiceType(CreateMetadataService.MetadataServiceType.Amundsen)
            .withConnection(TestUtils.AMUNDSEN_CONNECTION);
    MetadataService metadataService = metadataServiceResourceTest.createEntity(createMetadata, ADMIN_AUTH_HEADERS);
    AMUNDSEN_SERVICE_REFERENCE = metadataService.getEntityReference();

    // Create Atlas Service
    createMetadata
        .withName("atlas")
        .withServiceType(CreateMetadataService.MetadataServiceType.Atlas)
        .withConnection(TestUtils.ATLAS_CONNECTION);

    metadataService = metadataServiceResourceTest.createEntity(createMetadata, ADMIN_AUTH_HEADERS);
    ATLAS_SERVICE_REFERENCE = metadataService.getEntityReference();
  }

  @Test
  void post_withoutRequiredFields_400_badRequest(TestInfo test) {
    // Create metadata with mandatory serviceType field empty
    assertResponse(
        () -> createEntity(createRequest(test).withServiceType(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[serviceType must not be null]");

    // Create metadata with mandatory brokers field empty
    assertResponse(
        () -> createEntity(createRequest(test).withConnection(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[connection must not be null]");
  }

  @Test
  void post_validService_as_admin_200_ok(TestInfo test) throws IOException, URISyntaxException {
    // Create metadata service with different optional fields
    createAndCheckEntity(createRequest(test, 1).withDescription(null), ADMIN_AUTH_HEADERS);
    createAndCheckEntity(createRequest(test, 2).withDescription("description"), ADMIN_AUTH_HEADERS);
    createAndCheckEntity(
        createRequest(test, 3)
            .withConnection(
                new MetadataConnection()
                    .withConfig(
                        new AmundsenConnection()
                            .withHostPort(new URI("localhost:9092"))
                            .withUsername("admin")
                            .withPassword("admin"))),
        ADMIN_AUTH_HEADERS);
  }

  @Test
  void put_updateService_as_admin_2xx(TestInfo test) throws IOException, URISyntaxException {
    String secretPassword = "secret:/openmetadata/metadata/" + getEntityName(test) + "/password";
    MetadataService service =
        createAndCheckEntity(
            createRequest(test)
                .withDescription(null)
                .withConnection(
                    new MetadataConnection()
                        .withConfig(
                            new AmundsenConnection()
                                .withHostPort(new URI("localhost:9092"))
                                .withUsername("admin")
                                .withPassword(secretPassword))),
            ADMIN_AUTH_HEADERS);

    MetadataConnection metadataConnection =
        new MetadataConnection()
            .withConfig(
                new AmundsenConnection()
                    .withHostPort(new URI("localhost:9092"))
                    .withUsername("admin")
                    .withPassword(secretPassword));
    // Update metadata description
    CreateMetadataService update =
        createPutRequest(test).withDescription("description1").withConnection(metadataConnection);
    ChangeDescription change = getChangeDescription(service.getVersion());
    fieldAdded(change, "description", "description1");
    service = updateAndCheckEntity(update, OK, ADMIN_AUTH_HEADERS, TestUtils.UpdateType.MINOR_UPDATE, change);

    // Update connection
    MetadataConnection metadataConnection1 =
        new MetadataConnection()
            .withConfig(
                new AmundsenConnection()
                    .withHostPort(new URI("localhost:9094"))
                    .withUsername("admin1")
                    .withPassword("admin1"));
    change = getChangeDescription(service.getVersion());
    fieldUpdated(change, "connection", metadataConnection, metadataConnection1);
    update.withConnection(metadataConnection1);
    service = updateAndCheckEntity(update, OK, ADMIN_AUTH_HEADERS, TestUtils.UpdateType.MINOR_UPDATE, change);

    // Update description and connection
    MetadataConnection metadataConnection2 =
        new MetadataConnection()
            .withConfig(
                new AmundsenConnection()
                    .withHostPort(new URI("localhost:9095"))
                    .withUsername("admin2")
                    .withPassword("admin2"));
    update.withConnection(metadataConnection2);
    change = getChangeDescription(service.getVersion());
    fieldUpdated(change, "connection", metadataConnection1, metadataConnection2);
    update.setConnection(metadataConnection2);
    updateAndCheckEntity(update, OK, ADMIN_AUTH_HEADERS, TestUtils.UpdateType.MINOR_UPDATE, change);
  }

  @Override
  public CreateMetadataService createRequest(String name) {
    return new CreateMetadataService()
        .withName(name)
        .withServiceType(CreateMetadataService.MetadataServiceType.Amundsen)
        .withConnection(AMUNDSEN_CONNECTION);
  }

  @Override
  public CreateMetadataService createPutRequest(String name) {
    MetadataConnection metadataConnection = JsonUtils.convertValue(AMUNDSEN_CONNECTION, MetadataConnection.class);
    AmundsenConnection amundsenConnection =
        JsonUtils.convertValue(AMUNDSEN_CONNECTION.getConfig(), AmundsenConnection.class);
    String secretPassword = "secret:/openmetadata/metadata/" + name.toLowerCase() + "/password";
    return new CreateMetadataService()
        .withName(name)
        .withServiceType(CreateMetadataService.MetadataServiceType.Amundsen)
        .withConnection(metadataConnection.withConfig(amundsenConnection.withPassword(secretPassword)));
  }

  @Override
  public void validateCreatedEntity(
      MetadataService service, CreateMetadataService createRequest, Map<String, String> authHeaders) {
    MetadataConnection expectedMetadataConnection = createRequest.getConnection();
    MetadataConnection actualMetadataConnection = service.getConnection();
    validateConnection(expectedMetadataConnection, actualMetadataConnection, service.getServiceType());
  }

  @Override
  public void compareEntities(MetadataService expected, MetadataService updated, Map<String, String> authHeaders) {
    // PATCH operation is not supported by this entity
  }

  @Override
  public MetadataService validateGetWithDifferentFields(MetadataService service, boolean byName)
      throws HttpResponseException {
    String fields = "";
    service =
        byName
            ? getEntityByName(service.getFullyQualifiedName(), null, fields, ADMIN_AUTH_HEADERS)
            : getEntity(service.getId(), fields, ADMIN_AUTH_HEADERS);
    TestUtils.assertListNull(service.getOwner());

    fields = "owner,tags";
    service =
        byName
            ? getEntityByName(service.getFullyQualifiedName(), null, fields, ADMIN_AUTH_HEADERS)
            : getEntity(service.getId(), fields, ADMIN_AUTH_HEADERS);
    // Checks for other owner, tags, and followers is done in the base class
    return service;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if ("connection".equals(fieldName)) {
      assertTrue(((String) actual).contains("-encrypted-value"));
    } else {
      super.assertCommonFieldChange(fieldName, expected, actual);
    }
  }

  private void validateConnection(
      MetadataConnection expectedConnection,
      MetadataConnection actualConnection,
      CreateMetadataService.MetadataServiceType metadataServiceType) {
    if (expectedConnection != null
        && actualConnection != null
        && expectedConnection.getConfig() != null
        && actualConnection.getConfig() != null) {
      if (metadataServiceType == CreateMetadataService.MetadataServiceType.Atlas) {
        AtlasConnection expectedAtlasConnection = (AtlasConnection) expectedConnection.getConfig();
        AtlasConnection actualAtlasConnection;
        if (actualConnection.getConfig() instanceof AtlasConnection) {
          actualAtlasConnection = (AtlasConnection) actualConnection.getConfig();
        } else {
          actualAtlasConnection = JsonUtils.convertValue(actualConnection.getConfig(), AtlasConnection.class);
        }
        assertEquals(expectedAtlasConnection.getHostPort(), actualAtlasConnection.getHostPort());
      } else if (metadataServiceType == CreateMetadataService.MetadataServiceType.Amundsen) {
        AmundsenConnection expectedAmundsenConnection = (AmundsenConnection) expectedConnection.getConfig();
        AmundsenConnection actualAmundsenConnection;
        if (actualConnection.getConfig() instanceof AmundsenConnection) {
          actualAmundsenConnection = (AmundsenConnection) actualConnection.getConfig();
        } else {
          actualAmundsenConnection = JsonUtils.convertValue(actualConnection.getConfig(), AmundsenConnection.class);
        }
        assertEquals(expectedAmundsenConnection.getHostPort(), actualAmundsenConnection.getHostPort());
      }
    }
  }
}
