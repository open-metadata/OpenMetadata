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

package org.openmetadata.service.resources.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.UpdateType.NO_CHANGE;
import static org.openmetadata.service.util.TestUtils.assertListNull;

import jakarta.ws.rs.core.Response.Status;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.schema.api.ai.CreateAIGovernancePolicy;
import org.openmetadata.schema.api.ai.CreateAIGovernancePolicy.EnforcementLevel;
import org.openmetadata.schema.entity.ai.AIGovernancePolicy;
import org.openmetadata.schema.entity.ai.PolicyType;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.services.ai.AIGovernancePolicyService;
import org.openmetadata.service.services.ai.AIGovernancePolicyService.AIGovernancePolicyList;
import org.openmetadata.service.util.TestUtils;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class AIGovernancePolicyResourceTest
    extends EntityResourceTest<AIGovernancePolicy, CreateAIGovernancePolicy> {

  public AIGovernancePolicyResourceTest() {
    super(
        Entity.AI_GOVERNANCE_POLICY,
        AIGovernancePolicy.class,
        AIGovernancePolicyList.class,
        "aiGovernancePolicies",
        AIGovernancePolicyService.FIELDS);
  }

  @BeforeAll
  public void setup(TestInfo test) throws IOException, java.net.URISyntaxException {
    super.setup(test);
  }

  @Test
  void post_validAIGovernancePolicies_as_admin_200_OK(TestInfo test) throws IOException {
    CreateAIGovernancePolicy create = createRequest(test);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    create.withName(getEntityName(test, 1)).withDescription("description");
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void put_AIGovernancePolicyUpdateWithNoChange_200(TestInfo test) throws IOException {
    CreateAIGovernancePolicy request = createRequest(test).withOwners(List.of(USER1_REF));
    AIGovernancePolicy policy = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    ChangeDescription change = getChangeDescription(policy, NO_CHANGE);
    updateAndCheckEntity(request, Status.OK, ADMIN_AUTH_HEADERS, NO_CHANGE, change);
  }

  @Test
  void put_AIGovernancePolicyUpdatePolicyType_200(TestInfo test) throws IOException {
    CreateAIGovernancePolicy request = createRequest(test).withPolicyType(PolicyType.BiasThreshold);
    AIGovernancePolicy policy = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    ChangeDescription change = getChangeDescription(policy, MINOR_UPDATE);
    fieldUpdated(change, "policyType", PolicyType.BiasThreshold, PolicyType.ComplianceCheck);
    updateAndCheckEntity(
        request.withPolicyType(PolicyType.ComplianceCheck),
        Status.OK,
        ADMIN_AUTH_HEADERS,
        MINOR_UPDATE,
        change);
  }

  @Test
  void put_AIGovernancePolicyUpdateEnforcementLevel_200(TestInfo test) throws IOException {
    CreateAIGovernancePolicy request =
        createRequest(test).withEnforcementLevel(EnforcementLevel.WARNING);
    AIGovernancePolicy policy = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    ChangeDescription change = getChangeDescription(policy, MINOR_UPDATE);
    fieldUpdated(change, "enforcementLevel", EnforcementLevel.WARNING, EnforcementLevel.BLOCKING);
    updateAndCheckEntity(
        request.withEnforcementLevel(EnforcementLevel.BLOCKING),
        Status.OK,
        ADMIN_AUTH_HEADERS,
        MINOR_UPDATE,
        change);
  }

  @Override
  public AIGovernancePolicy validateGetWithDifferentFields(
      AIGovernancePolicy policy, boolean byName) throws HttpResponseException {
    String fields = "";
    policy =
        byName
            ? getEntityByName(policy.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(policy.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNull(policy.getOwners(), policy.getFollowers());

    fields = "owners,followers,tags,extension,domains";
    policy =
        byName
            ? getEntityByName(policy.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(policy.getId(), fields, ADMIN_AUTH_HEADERS);
    return policy;
  }

  @Override
  public CreateAIGovernancePolicy createRequest(String name) {
    return new CreateAIGovernancePolicy()
        .withName(name)
        .withPolicyType(PolicyType.BiasThreshold)
        .withEnforcementLevel(EnforcementLevel.WARNING);
  }

  @Override
  public void compareEntities(
      AIGovernancePolicy expected, AIGovernancePolicy updated, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertEquals(expected.getPolicyType().toString(), updated.getPolicyType().toString());
    assertEquals(
        expected.getEnforcementLevel().toString(), updated.getEnforcementLevel().toString());
    TestUtils.validateTags(expected.getTags(), updated.getTags());
    TestUtils.validateEntityReferences(updated.getFollowers());
  }

  @Override
  public void validateCreatedEntity(
      AIGovernancePolicy createdEntity,
      CreateAIGovernancePolicy createRequest,
      Map<String, String> authHeaders)
      throws HttpResponseException {
    assertEquals(
        createRequest.getPolicyType().toString(), createdEntity.getPolicyType().toString());
    assertEquals(
        createRequest.getEnforcementLevel().toString(),
        createdEntity.getEnforcementLevel().toString());
    TestUtils.validateTags(createRequest.getTags(), createdEntity.getTags());
    TestUtils.validateEntityReferences(createdEntity.getFollowers());
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    if (expected == actual) {
      return;
    }
    if (fieldName.equals("policyType") || fieldName.equals("enforcementLevel")) {
      assertEquals(expected.toString(), actual.toString(), "Field name " + fieldName);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }
}
