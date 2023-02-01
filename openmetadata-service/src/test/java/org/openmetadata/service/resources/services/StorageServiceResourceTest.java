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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import java.io.IOException;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.services.CreateStorageService;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.type.StorageServiceType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.services.storage.StorageServiceResource.StorageServiceList;
import org.openmetadata.service.util.ParallelizeTest;
import org.openmetadata.service.util.TestUtils;

@Slf4j
@ParallelizeTest
public class StorageServiceResourceTest extends EntityResourceTest<StorageService, CreateStorageService> {
  public StorageServiceResourceTest() {
    super(Entity.STORAGE_SERVICE, StorageService.class, StorageServiceList.class, "services/storageServices", "owner");
    this.supportsPatch = false;
  }

  public void setupStorageServices() throws HttpResponseException {
    // Create AWS storage service, S3
    StorageServiceResourceTest storageServiceResourceTest = new StorageServiceResourceTest();
    CreateStorageService createService =
        new CreateStorageService().withName(getEntityName("s3")).withServiceType(StorageServiceType.S3);
    StorageService service = storageServiceResourceTest.createEntity(createService, ADMIN_AUTH_HEADERS);
    AWS_STORAGE_SERVICE_REFERENCE = service.getEntityReference();

    // Create GCP storage service, GCS
    createService.withName(getEntityName("gs")).withServiceType(StorageServiceType.GCS);
    service = storageServiceResourceTest.createEntity(createService, ADMIN_AUTH_HEADERS);
    GCP_STORAGE_SERVICE_REFERENCE = service.getEntityReference();
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

  @Override
  public CreateStorageService createRequest(String name) {
    return new CreateStorageService().withName(name).withServiceType(StorageServiceType.S3);
  }

  @Override
  public void validateCreatedEntity(
      StorageService service, CreateStorageService createRequest, Map<String, String> authHeaders) {
    assertEquals(createRequest.getName(), service.getName());
  }

  @Override
  public void compareEntities(StorageService expected, StorageService updated, Map<String, String> authHeaders) {
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
    TestUtils.assertListNull(service.getOwner());

    fields = "owner";
    service =
        byName
            ? getEntityByName(service.getFullyQualifiedName(), null, fields, ADMIN_AUTH_HEADERS)
            : getEntity(service.getId(), fields, ADMIN_AUTH_HEADERS);
    // Checks for other owner, tags, and followers is done in the base class
    return service;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    super.assertCommonFieldChange(fieldName, expected, actual);
  }
}
