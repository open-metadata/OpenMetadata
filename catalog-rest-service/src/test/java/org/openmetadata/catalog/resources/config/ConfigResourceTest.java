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

package org.openmetadata.catalog.resources.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import javax.ws.rs.client.WebTarget;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.catalog.CatalogApplicationTest;
import org.openmetadata.catalog.entity.teams.Role;
import org.openmetadata.catalog.resources.teams.RoleResource;
import org.openmetadata.catalog.resources.teams.RoleResourceTest;
import org.openmetadata.catalog.resources.teams.UserResourceTest;
import org.openmetadata.catalog.security.Permissions;
import org.openmetadata.catalog.security.SecurityUtil;
import org.openmetadata.catalog.type.MetadataOperation;
import org.openmetadata.catalog.util.TestUtils;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ConfigResourceTest extends CatalogApplicationTest {
  private static final String DATA_STEWARD_ROLE_NAME = "DataSteward";
  private static final String DATA_CONSUMER_ROLE_NAME = "DataConsumer";
  private static final String DATA_STEWARD_USER_NAME = "user-data-steward";
  private static final String DATA_CONSUMER_USER_NAME = "user-data-consumer";

  @BeforeAll
  static void setup() throws IOException {
    RoleResourceTest roleResourceTest = new RoleResourceTest();
    UserResourceTest userResourceTest = new UserResourceTest();

    Role dataStewardRole =
        roleResourceTest.getEntityByName(DATA_STEWARD_ROLE_NAME, RoleResource.FIELDS, ADMIN_AUTH_HEADERS);
    userResourceTest.createEntity(
        userResourceTest
            .createRequest(DATA_STEWARD_USER_NAME, "", "", null)
            .withRoles(List.of(dataStewardRole.getId())),
        ADMIN_AUTH_HEADERS);

    Role dataConsumerRole =
        roleResourceTest.getEntityByName(DATA_CONSUMER_ROLE_NAME, RoleResource.FIELDS, ADMIN_AUTH_HEADERS);
    userResourceTest.createEntity(
        userResourceTest
            .createRequest(DATA_CONSUMER_USER_NAME, "", "", null)
            .withRoles(List.of(dataConsumerRole.getId())),
        ADMIN_AUTH_HEADERS);
  }

  @ParameterizedTest
  @MethodSource("getPermissionsTestParams")
  void get_permissions(String username, Map<MetadataOperation, Boolean> expectedOperations)
      throws HttpResponseException {
    WebTarget target = getConfigResource("permissions");
    Map<String, String> authHeaders = SecurityUtil.authHeaders(username + "@open-metadata.org");
    Permissions permissions = TestUtils.get(target, Permissions.class, authHeaders);
    Map<MetadataOperation, Boolean> actualOperations = permissions.getMetadataOperations();

    assertEquals(expectedOperations, actualOperations);
  }

  private Stream<Arguments> getPermissionsTestParams() {
    return Stream.of(
        Arguments.of(
            TestUtils.ADMIN_USER_NAME,
            new HashMap<MetadataOperation, Boolean>() {
              {
                put(MetadataOperation.SuggestDescription, Boolean.TRUE);
                put(MetadataOperation.SuggestTags, Boolean.TRUE);
                put(MetadataOperation.UpdateDescription, Boolean.TRUE);
                put(MetadataOperation.UpdateLineage, Boolean.TRUE);
                put(MetadataOperation.UpdateOwner, Boolean.TRUE);
                put(MetadataOperation.UpdateTags, Boolean.TRUE);
              }
            }),
        Arguments.of(
            DATA_STEWARD_USER_NAME,
            new HashMap<MetadataOperation, Boolean>() {
              {
                put(MetadataOperation.SuggestDescription, Boolean.FALSE);
                put(MetadataOperation.SuggestTags, Boolean.FALSE);
                put(MetadataOperation.UpdateDescription, Boolean.TRUE);
                put(MetadataOperation.UpdateLineage, Boolean.TRUE);
                put(MetadataOperation.UpdateOwner, Boolean.TRUE);
                put(MetadataOperation.UpdateTags, Boolean.TRUE);
              }
            }),
        Arguments.of(
            DATA_CONSUMER_USER_NAME,
            new HashMap<MetadataOperation, Boolean>() {
              {
                put(MetadataOperation.SuggestDescription, Boolean.FALSE);
                put(MetadataOperation.SuggestTags, Boolean.FALSE);
                put(MetadataOperation.UpdateDescription, Boolean.FALSE);
                put(MetadataOperation.UpdateLineage, Boolean.FALSE);
                put(MetadataOperation.UpdateOwner, Boolean.FALSE);
                put(MetadataOperation.UpdateTags, Boolean.FALSE);
              }
            }));
  }
}
