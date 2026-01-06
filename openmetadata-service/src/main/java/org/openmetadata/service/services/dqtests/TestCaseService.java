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

package org.openmetadata.service.services.dqtests;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.json.JsonPatch;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TableData;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TestCaseRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.dqtests.TestCaseMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.RestUtil.DeleteResponse;
import org.openmetadata.service.util.RestUtil.PatchResponse;
import org.openmetadata.service.util.RestUtil.PutResponse;

@Slf4j
@Singleton
@Service(entityType = Entity.TEST_CASE)
public class TestCaseService extends EntityBaseService<TestCase, TestCaseRepository> {

  public static final String FIELDS =
      "owners,reviewers,entityStatus,testSuite,testDefinition,testSuites,incidentId,domains,tags,followers";

  @Getter private final TestCaseMapper mapper;

  @Inject
  public TestCaseService(
      TestCaseRepository repository, Authorizer authorizer, TestCaseMapper mapper, Limits limits) {
    super(
        new ResourceEntityInfo<>(Entity.TEST_CASE, TestCase.class), repository, authorizer, limits);
    this.mapper = mapper;
  }

  @Override
  public TestCase addHref(UriInfo uriInfo, TestCase test) {
    super.addHref(uriInfo, test);
    Entity.withHref(uriInfo, test.getTestSuite());
    Entity.withHref(uriInfo, test.getTestDefinition());
    return test;
  }

  public Response createMany(UriInfo uriInfo, List<TestCase> testCases) {
    repository.createMany(uriInfo, testCases);
    return Response.ok(testCases).build();
  }

  public Response patchTestCase(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, JsonPatch patch) {
    PatchResponse<TestCase> response =
        repository.patch(uriInfo, id, securityContext.getUserPrincipal().getName(), patch);
    if (response.entity().getTestCaseResult() != null
        && response.entity().getTestCaseResult().getTestCaseStatus() == TestCaseStatus.Success) {
      repository.deleteTestCaseFailedRowsSample(id);
    }
    addHref(uriInfo, response.entity());
    return response.toResponse();
  }

  public Response createOrUpdateTestCase(
      UriInfo uriInfo, SecurityContext securityContext, TestCase test) {
    repository.prepareInternal(test, true);
    PutResponse<TestCase> response =
        repository.createOrUpdate(uriInfo, test, securityContext.getUserPrincipal().getName());
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  public TestCase addFailedRowsSample(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      TableData tableData,
      boolean validate) {
    authorizeEditTests(securityContext, id);
    TestCase testCase = repository.find(id, Include.NON_DELETED);
    repository.setFields(testCase, new Fields(Set.of("testCaseResult")));
    if (testCase.getTestCaseResult() == null
        || !testCase.getTestCaseResult().getTestCaseStatus().equals(TestCaseStatus.Failed)) {
      throw new IllegalArgumentException("Failed rows can only be added to a failed test case.");
    }
    return addHref(uriInfo, repository.addFailedRowsSample(testCase, tableData, validate));
  }

  public TestCase addInspectionQuery(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, String query) {
    authorizeEditTests(securityContext, id);
    return addHref(uriInfo, repository.addInspectionQuery(uriInfo, id, query));
  }

  public TableData getFailedRowsSample(UriInfo uriInfo, SecurityContext securityContext, UUID id) {
    authorizeViewFailedRows(securityContext, id);
    ResourceContext<?> resourceContext = getResourceContextById(id);
    TestCase testCase = repository.find(id, Include.NON_DELETED);
    boolean authorizePII = authorizePII(securityContext, resourceContext.getOwners());
    return repository.getSampleData(testCase, authorizePII);
  }

  public Response deleteFailedRowsSample(SecurityContext securityContext, UUID id) {
    authorizeDeleteFailedRows(securityContext, id);
    DeleteResponse<TableData> response = repository.deleteTestCaseFailedRowsSample(id);
    return response.toResponse();
  }

  public Response deleteLogicalTestCase(
      SecurityContext securityContext, UUID testSuiteId, UUID id) {
    DeleteResponse<TestCase> response =
        repository.deleteTestCaseFromLogicalTestSuite(testSuiteId, id);
    return response.toResponse();
  }

  public Response addTestCasesToLogicalTestSuite(
      SecurityContext securityContext, TestSuite testSuite, List<UUID> testCaseIds) {
    if (Boolean.TRUE.equals(testSuite.getBasic())) {
      throw new IllegalArgumentException("You are trying to add test cases to a basic test suite.");
    }

    if (nullOrEmpty(testCaseIds)) {
      return new RestUtil.PutResponse<>(
              Response.Status.OK,
              testSuite,
              org.openmetadata.schema.type.EventType.ENTITY_NO_CHANGE)
          .toResponse();
    }

    int existingTestCaseCount = repository.getTestCaseCount(testCaseIds);
    if (existingTestCaseCount != testCaseIds.size()) {
      throw new IllegalArgumentException(
          "You are trying to add one or more test cases that do not exist.");
    }
    return repository.addTestCasesToLogicalTestSuite(testSuite, testCaseIds).toResponse();
  }

  public int getTestCaseCount(List<UUID> testCaseIds) {
    return repository.getTestCaseCount(testCaseIds);
  }

  private void authorizeEditTests(SecurityContext securityContext, UUID id) {
    OperationContext operationContext =
        new OperationContext(Entity.TEST_CASE, MetadataOperation.EDIT_TESTS);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
  }

  private void authorizeViewFailedRows(SecurityContext securityContext, UUID id) {
    OperationContext operationContext =
        new OperationContext(Entity.TEST_CASE, MetadataOperation.VIEW_TEST_CASE_FAILED_ROWS_SAMPLE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
  }

  private void authorizeDeleteFailedRows(SecurityContext securityContext, UUID id) {
    OperationContext operationContext =
        new OperationContext(
            Entity.TEST_CASE, MetadataOperation.DELETE_TEST_CASE_FAILED_ROWS_SAMPLE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
  }

  public static class TestCaseList extends ResultList<TestCase> {
    /* Required for serde */
  }

  public static class TestCaseResultList extends ResultList<TestCaseResult> {
    /* Required for serde */
  }
}
