package org.openmetadata.catalog.resources.services;

import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.CatalogApplicationTest;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.services.CreateStorageService;
import org.openmetadata.catalog.entity.services.StorageService;
import org.openmetadata.catalog.type.StorageServiceType;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.TestUtils;

import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response;
import java.util.Date;
import java.util.Map;
import java.util.UUID;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.CONFLICT;
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.authHeaders;

public class StorageServiceResourceTest extends CatalogApplicationTest {
    @Test
    public void post_ServiceWithLongName_400_badRequest(TestInfo test) {
        // Create storage with mandatory name field empty
        CreateStorageService create = create(test).withName(TestUtils.LONG_ENTITY_NAME);
        HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
                createService(create, adminAuthHeaders()));
        TestUtils.assertResponse(exception, BAD_REQUEST, "[name size must be between 1 and 64]");
    }

    @Test
    public void post_ServiceWithoutName_400_badRequest(TestInfo test) {
        // Create storage with mandatory name field empty
        CreateStorageService create = create(test).withName("");
        HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
                createService(create, adminAuthHeaders()));
        TestUtils.assertResponse(exception, BAD_REQUEST, "[name size must be between 1 and 64]");
    }
    
    @Test
    public void post_ServiceAlreadyExists_409(TestInfo test) throws HttpResponseException {
        CreateStorageService create = create(test);
        createService(create, adminAuthHeaders());
        HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
                createService(create, adminAuthHeaders()));
        TestUtils.assertResponse(exception, CONFLICT, CatalogExceptionMessage.ENTITY_ALREADY_EXISTS);
    }

    @Test
    public void post_validService_as_admin_200_ok(TestInfo test) throws HttpResponseException {
        // Create storage service with different optional fields
        Map<String, String> authHeaders = adminAuthHeaders();
        createAndCheckService(create(test, 1).withDescription(null), authHeaders);
        createAndCheckService(create(test, 2).withDescription("description"), authHeaders);
    }
    
    @Test
    public void post_validService_as_non_admin_401(TestInfo test)  {
        // Create storage service with different optional fields
        Map<String, String> authHeaders = authHeaders("test@open-metadata.org");

        HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
                createAndCheckService(create(test, 1).withDescription(null), authHeaders));
        TestUtils.assertResponse(exception, FORBIDDEN,
                "Principal: CatalogPrincipal{name='test'} is not admin");
    }

    @Test
    public void put_updateStorageService_as_admin_2xx(TestInfo test) throws HttpResponseException {
        StorageService dbService = createAndCheckService(create(test).withDescription(null), adminAuthHeaders());
        String id = dbService.getId().toString();

        // Update storage description and ingestion service that are null
        CreateStorageService update = create(test).withDescription("description1");
        updateAndCheckService(update, OK, adminAuthHeaders());

        // Update description and ingestion schedule again
        update.withDescription("description1");
        updateAndCheckService(update, OK, adminAuthHeaders());
    }

    @Test
    public void put_update_as_non_admin_401(TestInfo test) throws HttpResponseException {
        Map<String, String> authHeaders = adminAuthHeaders();
        StorageService dbService = createAndCheckService(create(test).withDescription(null), authHeaders);

        // Update storage description and ingestion service that are null
        HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
                updateAndCheckService(create(test), OK, authHeaders("test@open-metadata.org")));
        TestUtils.assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} " +
                "is not admin");
    }

    @Test
    public void get_nonExistentStorageService_404_notFound() {
        HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
                getService(TestUtils.NON_EXISTENT_ENTITY, adminAuthHeaders()));
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
        StorageService storageService = createService(create(test), authHeaders);
        deleteService(storageService.getId(), storageService.getName(), authHeaders);
    }

    @Test
    public void delete_as_user_401(TestInfo test) throws HttpResponseException {
        Map<String, String> authHeaders = adminAuthHeaders();
        StorageService storageService = createService(create(test), authHeaders);
        HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
                deleteService(storageService.getId(), storageService.getName(),
                        authHeaders("test@open-metadata.org")));
        TestUtils.assertResponse(exception, FORBIDDEN,
                "Principal: CatalogPrincipal{name='test'} is not admin");
    }

    @Test
    public void delete_notExistentStorageService() {
        HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
                getService(TestUtils.NON_EXISTENT_ENTITY, adminAuthHeaders()));
        TestUtils.assertResponse(exception, NOT_FOUND,
                CatalogExceptionMessage.entityNotFound(Entity.STORAGE_SERVICE, TestUtils.NON_EXISTENT_ENTITY));
    }
    
    public static CreateStorageService create(TestInfo test) {
        return new CreateStorageService().withName(getName(test))
                .withServiceType(StorageServiceType.S3);
    }

    private static CreateStorageService create(TestInfo test, int index) {
        return new CreateStorageService().withName(getName(test, index))
                .withServiceType(StorageServiceType.S3);
    }

    public static String getName(TestInfo test) {
        return String.format("storage_service_%s", test.getDisplayName());
    }

    public static String getName(TestInfo test, int index) {
        return String.format("storage_service_%d_%s", index, test.getDisplayName());
    }
    
    public static StorageService createService(CreateStorageService create,
                                                Map<String, String> authHeaders) throws HttpResponseException {
        return TestUtils.post(CatalogApplicationTest.getResource("services/storageServices"),
                create, StorageService.class, authHeaders);
    }

    public static StorageService createAndCheckService(CreateStorageService create,
                                                        Map<String, String> authHeaders) throws HttpResponseException {
        StorageService service = createService(create, authHeaders);
        validateService(service, create.getName(), create.getDescription());

        // GET the newly created service and validate
        StorageService getService = getService(service.getId(), authHeaders);
        validateService(getService, create.getName(), create.getDescription());

        // GET the newly created service by name and validate
        getService = getServiceByName(service.getName(), null, authHeaders);
        validateService(getService, create.getName(), create.getDescription());
        return service;
    }

    private static void validateService(StorageService service, String expectedName, String expectedDescription) {
        assertNotNull(service.getId());
        assertNotNull(service.getHref());
        assertEquals(expectedName, service.getName());
        assertEquals(expectedDescription, service.getDescription());
    }

    public static StorageService getService(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
        return getService(id, null, authHeaders);
    }

    public static StorageService getService(UUID id, String fields, Map<String, String> authHeaders)
            throws HttpResponseException {
        WebTarget target = CatalogApplicationTest.getResource("services/storageServices/" + id);
        target = fields != null ? target.queryParam("fields", fields) : target;
        return TestUtils.get(target, StorageService.class, authHeaders);
    }

    public static StorageService getServiceByName(String name, String fields, Map<String, String> authHeaders)
            throws HttpResponseException {
        WebTarget target = CatalogApplicationTest.getResource("services/storageServices/name/" + name);
        target = fields != null ? target.queryParam("fields", fields) : target;
        return TestUtils.get(target, StorageService.class, authHeaders);
    }

    public static StorageService updateStorageService(CreateStorageService updated,
                                                        Response.Status status, Map<String, String> authHeaders)
            throws HttpResponseException {
        return TestUtils.put(CatalogApplicationTest.getResource("services/storageServices"), updated,
                StorageService.class, status, authHeaders);
    }

    public static void updateAndCheckService(CreateStorageService update, Response.Status status,
                                             Map<String, String> authHeaders) throws HttpResponseException {
        StorageService service = updateStorageService(update, status, authHeaders);
        validateService(service, service.getName(), update.getDescription());

        // GET the newly updated storage and validate
        StorageService getService = getService(service.getId(), authHeaders);
        validateService(getService, service.getName(), update.getDescription());

        // GET the newly updated storage by name and validate
        getService = getServiceByName(service.getName(), null, authHeaders);
        validateService(getService, service.getName(), update.getDescription());
    }

    private void deleteService(UUID id, String name, Map<String, String> authHeaders) throws HttpResponseException {
        TestUtils.delete(CatalogApplicationTest.getResource("services/storageServices/" + id), authHeaders);

        // Ensure deleted service does not exist
        HttpResponseException exception = assertThrows(HttpResponseException.class, () -> getService(id, authHeaders));
        TestUtils.assertResponse(exception, NOT_FOUND,
                CatalogExceptionMessage.entityNotFound(Entity.STORAGE_SERVICE, id));

        // Ensure deleted service does not exist when getting by name
        exception = assertThrows(HttpResponseException.class, () -> getServiceByName(name, null, authHeaders));
        TestUtils.assertResponse(exception, NOT_FOUND,
                CatalogExceptionMessage.entityNotFound(Entity.STORAGE_SERVICE, name));
    }
}
