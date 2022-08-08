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

package org.openmetadata.catalog.resources.permissions;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.catalog.type.MetadataOperation.EDIT_DESCRIPTION;
import static org.openmetadata.catalog.type.MetadataOperation.EDIT_DISPLAY_NAME;
import static org.openmetadata.catalog.type.MetadataOperation.EDIT_LINEAGE;
import static org.openmetadata.catalog.type.MetadataOperation.EDIT_OWNER;
import static org.openmetadata.catalog.type.MetadataOperation.EDIT_TAGS;
import static org.openmetadata.catalog.type.MetadataOperation.VIEW_ALL;
import static org.openmetadata.catalog.type.Permission.Access.ALLOW;
import static org.openmetadata.catalog.type.Permission.Access.CONDITIONAL_ALLOW;
import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import javax.ws.rs.client.WebTarget;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.catalog.CatalogApplicationTest;
import org.openmetadata.catalog.entity.policies.Policy;
import org.openmetadata.catalog.entity.policies.accessControl.Rule;
import org.openmetadata.catalog.entity.teams.Role;
import org.openmetadata.catalog.resources.permissions.PermissionsResource.ResourcePermissionList;
import org.openmetadata.catalog.resources.policies.PolicyResource;
import org.openmetadata.catalog.resources.policies.PolicyResourceTest;
import org.openmetadata.catalog.resources.teams.RoleResource;
import org.openmetadata.catalog.resources.teams.RoleResourceTest;
import org.openmetadata.catalog.resources.teams.UserResourceTest;
import org.openmetadata.catalog.security.SecurityUtil;
import org.openmetadata.catalog.security.policyevaluator.PolicyEvaluator;
import org.openmetadata.catalog.type.MetadataOperation;
import org.openmetadata.catalog.type.Permission;
import org.openmetadata.catalog.type.ResourcePermission;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.TestUtils;

@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class PermissionsResourceTest extends CatalogApplicationTest {
  private static final String ORG_POLICY_NAME = "OrganizationPolicy";
  private static Policy ORG_POLICY;
  private static List<Rule> ORG_RULES;

  private static final String DATA_STEWARD_ROLE_NAME = "DataSteward";
  private static Role DATA_STEWARD_ROLE;
  private static final String DATA_STEWARD_POLICY_NAME = "DataStewardPolicy";
  private static Policy DATA_STEWARD_POLICY;
  private static List<Rule> DATA_STEWARD_RULES;

  private static final String DATA_CONSUMER_ROLE_NAME = "DataConsumer";
  private static Role DATA_CONSUMER_ROLE;
  private static final String DATA_CONSUMER_POLICY_NAME = "DataConsumerPolicy";
  private static Policy DATA_CONSUMER_POLICY;
  private static List<Rule> DATA_CONSUMER_RULES;

  private static final String DATA_STEWARD_USER_NAME = "user-data-steward";
  private static final String DATA_CONSUMER_USER_NAME = "user-data-consumer";

  @BeforeAll
  static void setup() throws IOException {
    RoleResourceTest roleResourceTest = new RoleResourceTest();
    PolicyResourceTest policyResourceTest = new PolicyResourceTest();
    UserResourceTest userResourceTest = new UserResourceTest();

    ORG_POLICY = policyResourceTest.getEntityByName(ORG_POLICY_NAME, null, PolicyResource.FIELDS, ADMIN_AUTH_HEADERS);
    ORG_RULES = EntityUtil.resolveRules(ORG_POLICY.getRules());

    DATA_STEWARD_ROLE =
        roleResourceTest.getEntityByName(DATA_STEWARD_ROLE_NAME, null, RoleResource.FIELDS, ADMIN_AUTH_HEADERS);
    DATA_STEWARD_POLICY =
        policyResourceTest.getEntityByName(DATA_STEWARD_POLICY_NAME, null, PolicyResource.FIELDS, ADMIN_AUTH_HEADERS);
    DATA_STEWARD_RULES = EntityUtil.resolveRules(DATA_STEWARD_POLICY.getRules());

    DATA_STEWARD_ROLE =
        roleResourceTest.getEntityByName(DATA_STEWARD_ROLE_NAME, null, RoleResource.FIELDS, ADMIN_AUTH_HEADERS);
    DATA_STEWARD_POLICY =
        policyResourceTest.getEntityByName(DATA_STEWARD_POLICY_NAME, null, PolicyResource.FIELDS, ADMIN_AUTH_HEADERS);
    DATA_STEWARD_RULES = EntityUtil.resolveRules(DATA_STEWARD_POLICY.getRules());

    userResourceTest.createEntity(
        userResourceTest
            .createRequest(DATA_STEWARD_USER_NAME, "", "", null)
            .withRoles(List.of(DATA_STEWARD_ROLE.getId())),
        ADMIN_AUTH_HEADERS);

    DATA_CONSUMER_ROLE =
        roleResourceTest.getEntityByName(DATA_CONSUMER_ROLE_NAME, null, RoleResource.FIELDS, ADMIN_AUTH_HEADERS);
    DATA_CONSUMER_POLICY =
        policyResourceTest.getEntityByName(DATA_CONSUMER_POLICY_NAME, null, PolicyResource.FIELDS, ADMIN_AUTH_HEADERS);
    DATA_CONSUMER_RULES = EntityUtil.resolveRules(DATA_CONSUMER_POLICY.getRules());

    userResourceTest.createEntity(
        userResourceTest
            .createRequest(DATA_CONSUMER_USER_NAME, "", "", null)
            .withRoles(List.of(DATA_CONSUMER_ROLE.getId())),
        ADMIN_AUTH_HEADERS);
  }

  @Test
  void get_admin_permissions() throws HttpResponseException, JsonProcessingException {
    List<ResourcePermission> actualPermissions = getPermissions(ADMIN_AUTH_HEADERS);
    assertEquals(PolicyEvaluator.getResourcePermissions(ALLOW), actualPermissions);
  }

  @Test
  void get_dataConsumer_permissions() throws HttpResponseException {
    Map<String, String> authHeaders = SecurityUtil.authHeaders(DATA_CONSUMER_USER_NAME + "@open-metadata.org");
    List<ResourcePermission> actualPermissions = getPermissions(authHeaders);

    // Only allowed operations in DataConsumerRole. All other operations are notAllow by default
    List<MetadataOperation> allowed = List.of(VIEW_ALL, EDIT_DESCRIPTION, EDIT_TAGS);
    List<MetadataOperation> conditional = List.of(EDIT_OWNER);
    for (ResourcePermission actualPermission : actualPermissions) { // For all resources
      for (Permission permission : actualPermission.getPermissions()) {
        if (allowed.contains(permission.getOperation())) {
          assertEquals(ALLOW, permission.getAccess());
          assertEquals(DATA_CONSUMER_ROLE_NAME, permission.getRole());
          assertEquals(DATA_CONSUMER_POLICY_NAME, permission.getPolicy());
          assertEquals(DATA_CONSUMER_RULES.get(0), permission.getRule());
        } else if (conditional.contains(permission.getOperation())) {
          assertEquals(CONDITIONAL_ALLOW, permission.getAccess());
          assertEquals(ORG_POLICY_NAME, permission.getPolicy());
          assertTrue(ORG_RULES.get(0).equals(permission.getRule()) || ORG_RULES.get(1).equals(permission.getRule()));
        }
      }
    }
  }

  @Test
  void get_dataSteward_permissions() throws HttpResponseException {
    Map<String, String> authHeaders = SecurityUtil.authHeaders(DATA_STEWARD_USER_NAME + "@open-metadata.org");
    List<ResourcePermission> actualPermissions = getPermissions(authHeaders);

    // Only allowed operations in DataConsumerRole. All other operations are notAllow by default
    List<MetadataOperation> allowed =
        List.of(VIEW_ALL, EDIT_OWNER, EDIT_DISPLAY_NAME, EDIT_LINEAGE, EDIT_DESCRIPTION, EDIT_TAGS);
    for (ResourcePermission actualPermission : actualPermissions) { // For all resources
      for (Permission permission : actualPermission.getPermissions()) {
        if (allowed.contains(permission.getOperation())) {
          assertEquals(ALLOW, permission.getAccess());
          assertEquals(DATA_STEWARD_ROLE_NAME, permission.getRole());
          assertEquals(DATA_STEWARD_POLICY_NAME, permission.getPolicy());
          assertEquals(DATA_STEWARD_RULES.get(0), permission.getRule());
        }
      }
    }
  }

  public List<ResourcePermission> getPermissions(Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = getResource("permissions");
    return TestUtils.get(target, ResourcePermissionList.class, authHeaders).getData();
  }
}
