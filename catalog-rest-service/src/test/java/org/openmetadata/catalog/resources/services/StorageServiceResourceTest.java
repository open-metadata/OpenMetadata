package org.openmetadata.catalog.resources.services;

import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.CatalogApplicationTest;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.services.CreateStorageService;
import org.openmetadata.catalog.entity.services.StorageService;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.jdbi3.StorageServiceRepository.StorageServiceEntityInterface;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.services.storage.StorageServiceResource.StorageServiceList;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.StorageServiceType;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.TestUtils;
import org.openmetadata.catalog.util.TestUtils.UpdateType;

import javax.ws.rs.client.WebTarget;
import java.io.IOException;
import java.net.URISyntaxException;
import java.util.Map;
import java.util.UUID;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.CONFLICT;
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.authHeaders;
import static org.openmetadata.catalog.util.TestUtils.getPrincipal;

public class StorageServiceResourceTest extends EntityResourceTest<StorageService> {
  public StorageServiceResourceTest() {
    super(Entity.STORAGE_SERVICE, StorageService.class, StorageServiceList.class,
            "services/storageServices", "", false, false, false);
    this.supportsPatch = false;
  }

  @Test
  public void post_ServiceWithLongName_400_badRequest(TestInfo test) {
    // Create storage with mandatory name field empty
    CreateStorageService create = create(test).withName(TestUtils.LONG_ENTITY_NAME);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createEntity(create, adminAuthHeaders()));
    TestUtils.assertResponse(exception, BAD_REQUEST, "[name size must be between 1 and 64]");
  }

  @Test
  public void post_ServiceWithoutName_400_badRequest(TestInfo test) {
    // Create storage with mandatory name field empty
    CreateStorageService create = create(test).withName("");
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createEntity(create, adminAuthHeaders()));
    TestUtils.assertResponse(exception, BAD_REQUEST, "[name size must be between 1 and 64]");
  }

  @Test
  public void post_ServiceAlreadyExists_409(TestInfo test) throws HttpResponseException {
    CreateStorageService create = create(test);
    createEntity(create, adminAuthHeaders());
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createEntity(create, adminAuthHeaders()));
    TestUtils.assertResponse(exception, CONFLICT, CatalogExceptionMessage.ENTITY_ALREADY_EXISTS);
  }

  @Test
  public void post_validService_as_admin_200_ok(TestInfo test) throws IOException {
    // Create storage service with different optional fields
    Map<String, String> authHeaders = adminAuthHeaders();
    createAndCheckEntity(create(test, 1).withDescription(null), authHeaders);
    createAndCheckEntity(create(test, 2).withDescription("description"), authHeaders);
  }

  @Test
  public void post_validService_as_non_admin_401(TestInfo test) {
    // Create storage service with different optional fields
    Map<String, String> authHeaders = authHeaders("test@open-metadata.org");

    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createAndCheckEntity(create(test, 1).withDescription(null), authHeaders));
    TestUtils.assertResponse(exception, FORBIDDEN,
            "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  public void put_updateStorageService_as_admin_2xx(TestInfo test) throws IOException {
    createAndCheckEntity(create(test).withDescription(null), adminAuthHeaders());

    // TODO add more tests for different fields
  }

  @Test
  public void put_update_as_non_admin_401(TestInfo test) throws IOException {
    Map<String, String> authHeaders = adminAuthHeaders();
    createAndCheckEntity(create(test).withDescription(null), authHeaders);

    // Update storage description and ingestion service that are null
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            updateAndCheckEntity(create(test), OK, authHeaders("test@open-metadata.org"),
                    UpdateType.NO_CHANGE, null));
    TestUtils.assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} " +
            "is not admin");
  }

  @Test
  public void get_nonExistentStorageService_404_notFound() {
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            getEntity(TestUtils.NON_EXISTENT_ENTITY, adminAuthHeaders()));
    TestUtils.assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound(Entity.STORAGE_SERVICE,
            TestUtils.NON_EXISTENT_ENTITY));
  }

  @Test
  public void get_nonExistentStorageServiceByName_404_notFound() {
    HttpResponseException exception = assertThrows(HttpResponseException.class, ()
            -> getServiceByName("invalidName", null, adminAuthHeaders()));
    TestUtils.assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound(Entity.STORAGE_SERVICE,
            "invalidName"));
  }

  @Test
  public void delete_ExistentService_as_admin_200(TestInfo test) throws HttpResponseException {
    Map<String, String> authHeaders = adminAuthHeaders();
    StorageService storageService = createEntity(create(test), authHeaders);
    deleteService(storageService.getId(), storageService.getName(), authHeaders);
  }

  @Test
  public void delete_as_user_401(TestInfo test) throws HttpResponseException {
    Map<String, String> authHeaders = adminAuthHeaders();
    StorageService storageService = createEntity(create(test), authHeaders);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            deleteService(storageService.getId(), storageService.getName(),
                    authHeaders("test@open-metadata.org")));
    TestUtils.assertResponse(exception, FORBIDDEN,
            "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  public void delete_notExistentStorageService() {
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            getEntity(TestUtils.NON_EXISTENT_ENTITY, adminAuthHeaders()));
    TestUtils.assertResponse(exception, NOT_FOUND,
            CatalogExceptionMessage.entityNotFound(Entity.STORAGE_SERVICE, TestUtils.NON_EXISTENT_ENTITY));
  }

  public static CreateStorageService create(TestInfo test) {
    return new CreateStorageService().withName(getName(test)).withServiceType(StorageServiceType.S3);
  }

  private static CreateStorageService create(TestInfo test, int index) {
    return new CreateStorageService().withName(getName(test, index))
            .withServiceType(StorageServiceType.S3);
  }

  public static String getName(TestInfo test) {
    return String.format("storageSvc_%s", test.getDisplayName());
  }

  public static String getName(TestInfo test, int index) {
    return String.format("storageSvc_%d_%s", index, test.getDisplayName());
  }

  public static StorageService getServiceByName(String name, String fields, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("services/storageServices/name/" + name);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, StorageService.class, authHeaders);
  }

  private void deleteService(UUID id, String name, Map<String, String> authHeaders) throws HttpResponseException {
    TestUtils.delete(CatalogApplicationTest.getResource("services/storageServices/" + id), authHeaders);

    // Ensure deleted service does not exist
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> getEntity(id, authHeaders));
    TestUtils.assertResponse(exception, NOT_FOUND,
            CatalogExceptionMessage.entityNotFound(Entity.STORAGE_SERVICE, id));

    // Ensure deleted service does not exist when getting by name
    exception = assertThrows(HttpResponseException.class, () -> getServiceByName(name, null, authHeaders));
    TestUtils.assertResponse(exception, NOT_FOUND,
            CatalogExceptionMessage.entityNotFound(Entity.STORAGE_SERVICE, name));
  }

  @Override
  public Object createRequest(TestInfo test, int index, String description, String displayName,
                              EntityReference owner) throws URISyntaxException {
    return create(test, index).withDescription(description);
  }

  @Override
  public void validateCreatedEntity(StorageService service, Object request, Map<String, String> authHeaders) throws HttpResponseException {
    CreateStorageService createRequest = (CreateStorageService) request;
    validateCommonEntityFields(getEntityInterface(service), createRequest.getDescription(),
            getPrincipal(authHeaders), null);
    assertEquals(createRequest.getName(), service.getName());
  }

  @Override
  public void validateUpdatedEntity(StorageService service, Object request, Map<String, String> authHeaders) throws HttpResponseException {
    validateCreatedEntity(service, request, authHeaders);
  }

  @Override
  public void compareEntities(StorageService expected, StorageService updated, Map<String, String> authHeaders) throws HttpResponseException {
    // PATCH operation is not supported by this entity
  }

  @Override
  public EntityInterface<StorageService> getEntityInterface(StorageService entity) {
    return new StorageServiceEntityInterface(entity);
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    super.assertCommonFieldChange(fieldName, expected, actual);
  }
}
