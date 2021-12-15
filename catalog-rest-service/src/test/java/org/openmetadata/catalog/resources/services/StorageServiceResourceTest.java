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

package org.openmetadata.catalog.resources.services;

import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
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

import java.io.IOException;
import java.util.Map;

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
  public void delete_ExistentService_as_admin_200(TestInfo test) throws HttpResponseException {
    Map<String, String> authHeaders = adminAuthHeaders();
    StorageService storageService = createEntity(create(test), authHeaders);
    deleteEntity(storageService.getId(), authHeaders);
  }

  @Test
  public void delete_as_user_401(TestInfo test) throws HttpResponseException {
    Map<String, String> authHeaders = adminAuthHeaders();
    StorageService storageService = createEntity(create(test), authHeaders);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            deleteEntity(storageService.getId(), authHeaders("test@open-metadata.org")));
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

  private CreateStorageService create(TestInfo test) {
    return create(getEntityName(test));
  }

  private CreateStorageService create(TestInfo test, int index) {
    return create(getEntityName(test, index));
  }

  private CreateStorageService create(String entityName) {
    return new CreateStorageService().withName(entityName).withServiceType(StorageServiceType.S3);
  }

  @Override
  public Object createRequest(String name, String description, String displayName, EntityReference owner) {
    return create(name).withDescription(description);
  }

  @Override
  public void validateCreatedEntity(StorageService service, Object request, Map<String, String> authHeaders) {
    CreateStorageService createRequest = (CreateStorageService) request;
    validateCommonEntityFields(getEntityInterface(service), createRequest.getDescription(),
            getPrincipal(authHeaders), null);
    assertEquals(createRequest.getName(), service.getName());
  }

  @Override
  public void validateUpdatedEntity(StorageService service, Object request, Map<String, String> authHeaders) {
    validateCreatedEntity(service, request, authHeaders);
  }

  @Override
  public void compareEntities(StorageService expected, StorageService updated, Map<String, String> authHeaders) {
    // PATCH operation is not supported by this entity
  }

  @Override
  public EntityInterface<StorageService> getEntityInterface(StorageService entity) {
    return new StorageServiceEntityInterface(entity);
  }

  @Override
  public void validateGetWithDifferentFields(StorageService service, boolean byName) throws HttpResponseException {
    // No fields support
    String fields = "";
    service = byName ? getEntityByName(service.getName(), fields, adminAuthHeaders()) :
            getEntity(service.getId(), fields, adminAuthHeaders());
    TestUtils.assertListNotNull(service.getHref(), service.getVersion(), service.getUpdatedBy(),
            service.getServiceType(), service.getUpdatedAt());
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    super.assertCommonFieldChange(fieldName, expected, actual);
  }
}