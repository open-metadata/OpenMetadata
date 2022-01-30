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

import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.TEST_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.getPrincipal;

import java.io.IOException;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.services.CreateStorageService;
import org.openmetadata.catalog.entity.services.StorageService;
import org.openmetadata.catalog.jdbi3.StorageServiceRepository.StorageServiceEntityInterface;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.services.storage.StorageServiceResource.StorageServiceList;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.StorageServiceType;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.TestUtils;
import org.openmetadata.catalog.util.TestUtils.UpdateType;

@Slf4j
public class StorageServiceResourceTest extends EntityResourceTest<StorageService, CreateStorageService> {
  public StorageServiceResourceTest() {
    super(
        Entity.STORAGE_SERVICE,
        StorageService.class,
        StorageServiceList.class,
        "services/storageServices",
        "",
        false,
        false,
        false,
        false);
    this.supportsPatch = false;
  }

  @Test
  void post_validService_as_admin_200_ok(TestInfo test) throws IOException {
    // Create storage service with different optional fields
    Map<String, String> authHeaders = ADMIN_AUTH_HEADERS;
    createAndCheckEntity(createRequest(test, 1).withDescription(null), authHeaders);
    createAndCheckEntity(createRequest(test, 2).withDescription("description"), authHeaders);
  }

  @Test
  void put_updateStorageService_as_admin_2xx(TestInfo test) throws IOException {
    createAndCheckEntity(createRequest(test).withDescription(null), ADMIN_AUTH_HEADERS);

    // TODO add more tests for different fields
  }

  @Test
  void put_update_as_non_admin_401(TestInfo test) throws IOException {
    createAndCheckEntity(createRequest(test).withDescription(null), ADMIN_AUTH_HEADERS);

    // Update storage description and ingestion service that are null
    HttpResponseException exception =
        assertThrows(
            HttpResponseException.class,
            () -> updateAndCheckEntity(createRequest(test), OK, TEST_AUTH_HEADERS, UpdateType.NO_CHANGE, null));
    TestUtils.assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} " + "is not admin");
  }

  @Override
  public CreateStorageService createRequest(
      String name, String description, String displayName, EntityReference owner) {
    return new CreateStorageService()
        .withName(name)
        .withServiceType(StorageServiceType.S3)
        .withDescription(description);
  }

  @Override
  public void validateCreatedEntity(
      StorageService service, CreateStorageService createRequest, Map<String, String> authHeaders) {
    validateCommonEntityFields(
        getEntityInterface(service), createRequest.getDescription(), getPrincipal(authHeaders), null);
    assertEquals(createRequest.getName(), service.getName());
  }

  @Override
  public void validateUpdatedEntity(
      StorageService service, CreateStorageService request, Map<String, String> authHeaders) {
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
    service =
        byName
            ? getEntityByName(service.getName(), "", ADMIN_AUTH_HEADERS)
            : getEntity(service.getId(), "", ADMIN_AUTH_HEADERS);
    TestUtils.assertListNotNull(
        service.getHref(),
        service.getVersion(),
        service.getUpdatedBy(),
        service.getServiceType(),
        service.getUpdatedAt());
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    super.assertCommonFieldChange(fieldName, expected, actual);
  }
}
