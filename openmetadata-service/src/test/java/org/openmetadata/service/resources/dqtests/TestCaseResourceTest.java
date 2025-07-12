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

package org.openmetadata.service.resources.dqtests;

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static jakarta.ws.rs.core.Response.Status.FORBIDDEN;
import static jakarta.ws.rs.core.Response.Status.NOT_FOUND;
import static jakarta.ws.rs.core.Response.Status.OK;
import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.api.teams.CreateTeam.TeamType.GROUP;
import static org.openmetadata.schema.type.ColumnDataType.BIGINT;
import static org.openmetadata.schema.type.MetadataOperation.DELETE;
import static org.openmetadata.schema.type.MetadataOperation.EDIT_TESTS;
import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
import static org.openmetadata.service.Entity.TABLE;
import static org.openmetadata.service.Entity.TEST_CASE;
import static org.openmetadata.service.Entity.TEST_DEFINITION;
import static org.openmetadata.service.exception.CatalogExceptionMessage.permissionNotAllowed;
import static org.openmetadata.service.jdbi3.TestCaseRepository.FAILED_ROWS_SAMPLE_EXTENSION;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.security.SecurityUtil.getPrincipalName;
import static org.openmetadata.service.security.mask.PIIMasker.MASKED_VALUE;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.INGESTION_BOT;
import static org.openmetadata.service.util.TestUtils.INGESTION_BOT_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.TEST_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.TEST_USER_NAME;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.assertEntityPagination;
import static org.openmetadata.service.util.TestUtils.assertListNotEmpty;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;
import static org.openmetadata.service.util.TestUtils.dateToTimestamp;

import com.fasterxml.jackson.databind.JsonNode;
import es.org.elasticsearch.client.Request;
import es.org.elasticsearch.client.Response;
import es.org.elasticsearch.client.RestClient;
import jakarta.ws.rs.client.WebTarget;
import java.io.IOException;
import java.text.ParseException;
import java.util.*;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.RandomStringUtils;
import org.apache.http.client.HttpResponseException;
import org.apache.http.util.EntityUtils;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.feed.CloseTask;
import org.openmetadata.schema.api.feed.ResolveTask;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.api.tests.CreateTestCaseResolutionStatus;
import org.openmetadata.schema.api.tests.CreateTestCaseResult;
import org.openmetadata.schema.api.tests.CreateTestSuite;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.tests.DataQualityReport;
import org.openmetadata.schema.tests.ResultSummary;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.tests.TestPlatform;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.Assigned;
import org.openmetadata.schema.tests.type.ColumnTestSummaryDefinition;
import org.openmetadata.schema.tests.type.Resolved;
import org.openmetadata.schema.tests.type.Severity;
import org.openmetadata.schema.tests.type.TestCaseFailureReasonType;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.tests.type.TestSummary;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.DataQualityDimensions;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TableData;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TaskStatus;
import org.openmetadata.schema.type.TestDefinitionEntityType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.feeds.FeedResourceTest;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.resources.policies.PolicyResourceTest;
import org.openmetadata.service.resources.teams.RoleResourceTest;
import org.openmetadata.service.resources.teams.TeamResourceTest;
import org.openmetadata.service.resources.teams.UserResourceTest;
import org.openmetadata.service.search.SearchAggregation;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.indexes.TestCaseIndex;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils;
import org.openmetadata.service.util.incidentSeverityClassifier.IncidentSeverityClassifierInterface;
import org.testcontainers.shaded.com.google.common.collect.ImmutableMap;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@Slf4j
public class TestCaseResourceTest extends EntityResourceTest<TestCase, CreateTestCase> {
  public static String TABLE_LINK;
  public static String TABLE_COLUMN_LINK;
  public static String TABLE_LINK_2;
  public static String TABLE_COLUMN_LINK_2;
  public static String INVALID_LINK1;
  public static String INVALID_LINK2;
  protected boolean supportsSearchIndex = true;
  private final String testCaseResultsCollectionName;

  // We’ll define some static references for convenience
  private static Policy POLICY_TABLE_EDIT_TESTS;
  private static Policy POLICY_TEST_CASE_CREATE;
  private static Policy POLICY_TEST_CASE_UPDATE;
  private static Policy POLICY_NO_PERMS;
  private static Policy POLICY_TABLE_OWNER_EDIT_TESTS;

  private static Role ROLE_TABLE_EDIT_TESTS;
  private static Role ROLE_TEST_CASE_CREATE;
  private static Role ROLE_TEST_CASE_UPDATE;
  private static Role ROLE_NO_PERMS;

  private static User USER_TABLE_EDIT_TESTS;
  private static User USER_TEST_CASE_CREATE;
  private static User USER_TEST_CASE_UPDATE;
  private static User USER_NO_PERMISSIONS;
  private static User USER_TABLE_OWNER;
  private static User CREATE_ALL_OPS_USER;

  public TestCaseResourceTest() {
    super(
        Entity.TEST_CASE,
        org.openmetadata.schema.tests.TestCase.class,
        TestCaseResource.TestCaseList.class,
        "dataQuality/testCases",
        TestCaseResource.FIELDS);
    supportsTags = false; // Test cases do not support setting tags directly (inherits from Entity)
    testCaseResultsCollectionName = "dataQuality/testCases/testCaseResults";
    supportsEtag = false;
  }

  public void setupTestCase(TestInfo test) throws IOException {
    TableResourceTest tableResourceTest = new TableResourceTest();
    CreateTable tableReq =
        tableResourceTest
            .createRequest(test)
            .withName("testCase'_ Table")
            .withDatabaseSchema(DATABASE_SCHEMA.getFullyQualifiedName())
            .withOwners(List.of(USER1_REF))
            .withColumns(
                List.of(
                    new Column().withName(C1).withDisplayName("c1").withDataType(BIGINT),
                    new Column()
                        .withName(C2)
                        .withDisplayName("c2")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(10),
                    new Column().withName(C3).withDisplayName("c3").withDataType(BIGINT)))
            .withOwners(List.of(USER1_REF));
    TEST_TABLE1 = tableResourceTest.createAndCheckEntity(tableReq, ADMIN_AUTH_HEADERS);
    tableReq =
        tableResourceTest
            .createRequest(test)
            .withName("testCaseTable" + UUID.randomUUID())
            .withDatabaseSchema(DATABASE_SCHEMA.getFullyQualifiedName())
            .withColumns(
                List.of(
                    new Column()
                        .withName(C1)
                        .withDisplayName("c1")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(10)))
            .withOwners(List.of(USER1_REF));
    TEST_TABLE2 = tableResourceTest.createAndCheckEntity(tableReq, ADMIN_AUTH_HEADERS);
    TABLE_LINK = String.format("<#E::table::%s>", TEST_TABLE1.getFullyQualifiedName());
    TABLE_LINK_2 = String.format("<#E::table::%s>", TEST_TABLE2.getFullyQualifiedName());
    TABLE_COLUMN_LINK =
        String.format("<#E::table::%s::columns::%s>", TEST_TABLE1.getFullyQualifiedName(), C1);
    TABLE_COLUMN_LINK_2 =
        String.format("<#E::table::%s::columns::%s>", TEST_TABLE2.getFullyQualifiedName(), C1);
    INVALID_LINK1 = String.format("<#E::dashboard::%s", "temp");
    INVALID_LINK2 = String.format("<#E::table::%s>", "non-existent");
  }

  @BeforeAll
  public void setupPoliciesRolesUsers() throws Exception {
    // -------------------------------------------------------------------------------------------
    // 1) Create actual Rules to be placed in the Policies
    //    Each rule grants certain operations on specific Entity types.
    // -------------------------------------------------------------------------------------------
    Rule tableEditTestsRule =
        new Rule()
            .withName("AllowTableEditTests")
            .withDescription("Allow EDIT_TESTS on TABLE entities")
            .withEffect(Rule.Effect.ALLOW)
            .withOperations(List.of(MetadataOperation.EDIT_TESTS))
            .withResources(List.of(TABLE));

    Rule testCaseCreateRule =
        new Rule()
            .withName("AllowTestCaseCreate")
            .withDescription("Allow CREATE on TEST_CASE entities")
            .withEffect(Rule.Effect.ALLOW)
            .withOperations(List.of(MetadataOperation.CREATE))
            .withResources(List.of(TEST_CASE));

    Rule testCaseUpdateRule =
        new Rule()
            .withName("AllowTestCaseUpdate")
            .withDescription("Allow UPDATE on TEST_CASE entities")
            .withEffect(Rule.Effect.ALLOW)
            .withOperations(List.of(MetadataOperation.EDIT_ALL))
            .withResources(List.of(TEST_CASE));

    // An empty or do-nothing rule for NoPermissions
    Rule noRelevantRule =
        new Rule()
            .withName("NoRelevantRule")
            .withEffect(Rule.Effect.DENY)
            .withOperations(List.of())
            .withResources(List.of(TEST_CASE));

    Rule tableOwnerEditTestsRule =
        new Rule()
            .withName("tableOwnerEditTestsRule")
            .withDescription("Allow EDIT_TESTS on TABLE if user isOwner()")
            .withEffect(Rule.Effect.ALLOW)
            .withOperations(List.of(MetadataOperation.EDIT_TESTS))
            .withResources(List.of(Entity.TABLE))
            .withCondition("isOwner()");

    Rule testCaseAllOpsRule =
        new Rule()
            .withName("testCaseAllOpsRule")
            .withDescription("Allow CREATE, UPDATE, DELETE on TEST_CASE entities")
            .withEffect(Rule.Effect.ALLOW)
            .withOperations(
                List.of(
                    MetadataOperation.CREATE, MetadataOperation.EDIT_ALL, MetadataOperation.DELETE))
            .withResources(List.of(Entity.TEST_CASE));

    PolicyResourceTest policyResourceTest = new PolicyResourceTest();
    POLICY_TABLE_EDIT_TESTS =
        policyResourceTest.createEntity(
            new CreatePolicy()
                .withName("Policy_TableEditTests")
                .withDescription("Policy that allows TABLE:EDIT_TESTS")
                .withRules(List.of(tableEditTestsRule)),
            ADMIN_AUTH_HEADERS);

    POLICY_TEST_CASE_CREATE =
        policyResourceTest.createEntity(
            new CreatePolicy()
                .withName("Policy_TestCaseCreate")
                .withDescription("Policy that allows TEST_CASE:CREATE")
                .withRules(List.of(testCaseCreateRule)),
            ADMIN_AUTH_HEADERS);

    POLICY_TEST_CASE_UPDATE =
        policyResourceTest.createEntity(
            new CreatePolicy()
                .withName("Policy_TestCaseUpdate")
                .withDescription("Policy that allows TEST_CASE:UPDATE")
                .withRules(List.of(testCaseUpdateRule)),
            ADMIN_AUTH_HEADERS);

    POLICY_NO_PERMS =
        policyResourceTest.createEntity(
            new CreatePolicy()
                .withName("Policy_NoPerms")
                .withDescription("Policy that grants no relevant perms")
                .withRules(List.of(noRelevantRule)),
            ADMIN_AUTH_HEADERS);

    POLICY_TABLE_OWNER_EDIT_TESTS =
        policyResourceTest.createEntity(
            new CreatePolicy()
                .withName("Policy_TableOwnerEditTests")
                .withRules(List.of(tableOwnerEditTestsRule)),
            ADMIN_AUTH_HEADERS);

    Policy POLICY_TEST_CASE_ALL_OPS =
        policyResourceTest.createEntity(
            new CreatePolicy()
                .withName("Policy_TestCaseAllOps")
                .withRules(List.of(testCaseAllOpsRule)),
            ADMIN_AUTH_HEADERS);

    RoleResourceTest roleResourceTest = new RoleResourceTest();
    ROLE_TABLE_EDIT_TESTS =
        roleResourceTest.createEntity(
            new CreateRole()
                .withName("Role_TableEditTests")
                .withDescription("Role that references POLICY_TABLE_EDIT_TESTS")
                .withPolicies(List.of(POLICY_TABLE_EDIT_TESTS.getFullyQualifiedName())),
            ADMIN_AUTH_HEADERS);

    ROLE_TEST_CASE_CREATE =
        roleResourceTest.createEntity(
            new CreateRole()
                .withName("Role_TestCaseCreate")
                .withPolicies(List.of(POLICY_TEST_CASE_CREATE.getFullyQualifiedName())),
            ADMIN_AUTH_HEADERS);

    ROLE_TEST_CASE_UPDATE =
        roleResourceTest.createEntity(
            new CreateRole()
                .withName("Role_TestCaseUpdate")
                .withPolicies(List.of(POLICY_TEST_CASE_UPDATE.getFullyQualifiedName())),
            ADMIN_AUTH_HEADERS);

    ROLE_NO_PERMS =
        roleResourceTest.createEntity(
            new CreateRole()
                .withName("Role_NoPermissions")
                .withPolicies(List.of(POLICY_NO_PERMS.getFullyQualifiedName())),
            ADMIN_AUTH_HEADERS);

    Role ROLE_TABLE_OWNER_EDIT_TESTS =
        roleResourceTest.createEntity(
            new CreateRole()
                .withName("Role_TableOwnerEditTests")
                .withPolicies(List.of(POLICY_TABLE_OWNER_EDIT_TESTS.getFullyQualifiedName())),
            ADMIN_AUTH_HEADERS);

    Role ROLE_TEST_CASE_ALL_OPS =
        roleResourceTest.createEntity(
            new CreateRole()
                .withName("Role_TestCaseAllOps")
                .withPolicies(List.of(POLICY_TEST_CASE_ALL_OPS.getFullyQualifiedName())),
            ADMIN_AUTH_HEADERS);

    UserResourceTest userResourceTest = new UserResourceTest();
    USER_TABLE_EDIT_TESTS =
        userResourceTest.createEntity(
            new CreateUser()
                .withName("user-table-edit-tests")
                .withEmail("user-table-edit-tests@open-metadata.org")
                .withRoles(List.of(ROLE_TABLE_EDIT_TESTS.getId())),
            ADMIN_AUTH_HEADERS);

    USER_TEST_CASE_CREATE =
        userResourceTest.createEntity(
            new CreateUser()
                .withName("user-test-case-create")
                .withEmail("user-test-case-create@open-metadata.org")
                .withRoles(List.of(ROLE_TEST_CASE_CREATE.getId())),
            ADMIN_AUTH_HEADERS);

    USER_TEST_CASE_UPDATE =
        userResourceTest.createEntity(
            new CreateUser()
                .withName("user-test-case-update")
                .withEmail("user-test-case-update@open-metadata.org")
                .withRoles(List.of(ROLE_TEST_CASE_UPDATE.getId())),
            ADMIN_AUTH_HEADERS);

    USER_NO_PERMISSIONS =
        userResourceTest.createEntity(
            new CreateUser()
                .withName("user-no-perms")
                .withEmail("user-no-perms@open-metadata.org")
                .withRoles(List.of(ROLE_NO_PERMS.getId())),
            ADMIN_AUTH_HEADERS);

    USER_TABLE_OWNER =
        userResourceTest.createEntity(
            new CreateUser()
                .withName("user-table-owner")
                .withEmail("user-table-owner@open-metadata.org")
                .withRoles(List.of(ROLE_TABLE_OWNER_EDIT_TESTS.getId())),
            ADMIN_AUTH_HEADERS);

    CREATE_ALL_OPS_USER =
        userResourceTest.createEntity(
            new CreateUser()
                .withName("user-test-case-all-ops")
                .withEmail("user-test-case-all-ops@open-metadata.org")
                .withRoles(List.of(ROLE_TEST_CASE_ALL_OPS.getId())),
            ADMIN_AUTH_HEADERS);
  }

  @Test
  void test_getEntityName(TestInfo test) {
    assertTrue(getEntityName(test).contains(supportedNameCharacters));
  }

  @Override
  @Test
  public void patch_entityDescriptionAndTestAuthorizer(TestInfo test) throws IOException {
    // TestCase is treated as an operation on an entity being tested, such as table
    TestCase entity =
        createEntity(
            createRequest(getEntityName(test), "description", null, null), ADMIN_AUTH_HEADERS);

    // Admin can edit tests
    entity = patchEntityAndCheckAuthorization(entity, ADMIN_USER_NAME, false);

    // Other roles and non-owner can't edit tests
    entity = patchEntityAndCheckAuthorization(entity, DATA_STEWARD.getName(), EDIT_TESTS, true);
    entity = patchEntityAndCheckAuthorization(entity, DATA_CONSUMER.getName(), EDIT_TESTS, true);
    patchEntityAndCheckAuthorization(entity, USER2.getName(), EDIT_TESTS, true);
  }

  @Test
  void patch_entityComputePassedFailedRowCount(TestInfo test) throws IOException {
    TestCase entity =
        createEntity(
            createRequest(getEntityName(test), "description", null, null), ADMIN_AUTH_HEADERS);
    String json = JsonUtils.pojoToJson(entity);
    entity.setComputePassedFailedRowCount(true);

    patchEntity(entity.getId(), json, entity, ADMIN_AUTH_HEADERS);

    entity = getEntity(entity.getId(), ADMIN_AUTH_HEADERS);

    assertTrue(entity.getComputePassedFailedRowCount());
  }

  @Test
  void post_testWithoutRequiredFields_4xx(TestInfo test) {
    // name is required field
    assertResponse(
        () -> createEntity(createRequest(test).withName(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param name must not be null]");
  }

  @Test
  void post_testWithInvalidEntityTestSuite_4xx(TestInfo test) throws IOException {
    CreateTestCase create = createRequest(test);
    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();

    create.withEntityLink(INVALID_LINK1);
    assertResponseContains(
        () -> createAndCheckEntity(create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        ENTITY_LINK_MATCH_ERROR);

    create.withEntityLink(INVALID_LINK2);
    assertResponseContains(
        () -> createAndCheckEntity(create, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        "table instance for non-existent not found");

    CreateTestCase create2 = createRequest(test);
    create2.withEntityLink(TABLE_LINK).withTestDefinition(TEST_SUITE1.getFullyQualifiedName());
    assertResponseContains(
        () -> createAndCheckEntity(create2, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        "testDefinition instance for " + TEST_SUITE1.getFullyQualifiedName() + " not found");
  }

  @Test
  void post_testWithInvalidParamValues_4xx(TestInfo test) {
    CreateTestCase create = createRequest(test);
    create
        .withEntityLink(TABLE_LINK)
        .withTestDefinition(TEST_DEFINITION2.getFullyQualifiedName())
        .withParameterValues(List.of(new TestCaseParameterValue().withName("col").withValue("x")));
    assertResponseContains(
        () -> createAndCheckEntity(create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Parameter Values doesn't match Test Definition Parameters");

    CreateTestCase create1 = createRequest(test);
    create1.withEntityLink(TABLE_LINK).withTestDefinition(TEST_DEFINITION3.getFullyQualifiedName());
    assertResponseContains(
        () -> createAndCheckEntity(create1, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Required parameter missingCountValue is not passed in parameterValues");
  }

  @Test
  void createUpdateDelete_tests_200(TestInfo test) throws IOException {
    // Create a test case
    CreateTestCase create = createRequest(test);
    create
        .withEntityLink(TABLE_LINK)
        .withTestDefinition(TEST_DEFINITION4.getFullyQualifiedName())
        .withParameterValues(
            List.of(new TestCaseParameterValue().withValue("100").withName("min")));
    TestCase testCase = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Change the test with PUT request
    create
        .withTestDefinition(TEST_DEFINITION5.getFullyQualifiedName())
        .withParameterValues(
            List.of(new TestCaseParameterValue().withValue("100").withName("value")));
    ChangeDescription change = getChangeDescription(testCase, MINOR_UPDATE);
    fieldUpdated(
        change,
        "testDefinition",
        TEST_DEFINITION4.getEntityReference(),
        TEST_DEFINITION5.getEntityReference());
    fieldUpdated(
        change,
        "parameterValues",
        testCase.getParameterValues(),
        List.of(new TestCaseParameterValue().withValue("100").withName("value")));
    updateAndCheckEntity(create, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void getTestCaseWithResult(TestInfo test) throws IOException, ParseException {
    CreateTestCase create = createRequest(test);
    create
        .withEntityLink(TABLE_LINK)
        .withTestDefinition(TEST_DEFINITION4.getFullyQualifiedName())
        .withParameterValues(
            List.of(new TestCaseParameterValue().withValue("100").withName("max")));
    TestCase testCase = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    CreateTestCaseResult createTestCaseResult =
        new CreateTestCaseResult()
            .withResult("tested")
            .withTestCaseStatus(TestCaseStatus.Success)
            .withTimestamp(TestUtils.dateToTimestamp("2021-09-11"));
    TestCaseResult testCaseResult =
        postTestCaseResult(
            testCase.getFullyQualifiedName(), createTestCaseResult, ADMIN_AUTH_HEADERS);

    Map<String, String> queryParams = Map.of("fields", Entity.TEST_CASE_RESULT);
    testCase = getTestCase(testCase.getFullyQualifiedName(), queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(testCaseResult, testCase.getTestCaseResult());

    ResultList<TestCase> testcases =
        listEntitiesFromSearch(Map.of("fields", "testCaseResult"), 100, 0, ADMIN_AUTH_HEADERS);
    UUID testCaseId = testCase.getId();
    TestCase testCaseFromSearch =
        testcases.getData().stream()
            .filter(tc -> tc.getId().equals(testCaseId))
            .findFirst()
            .orElse(null);
    assertNotNull(testCaseFromSearch);
    assertEquals(testCaseResult, testCaseFromSearch.getTestCaseResult());

    // insert test case for a past date
    createTestCaseResult =
        new CreateTestCaseResult()
            .withResult("tested")
            .withTestCaseStatus(TestCaseStatus.Success)
            .withTimestamp(TestUtils.dateToTimestamp("2021-09-01"));
    postTestCaseResult(testCase.getFullyQualifiedName(), createTestCaseResult, ADMIN_AUTH_HEADERS);
    testCase = getTestCase(testCase.getFullyQualifiedName(), queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(testCaseResult, testCase.getTestCaseResult());

    testCaseFromSearch =
        testcases.getData().stream()
            .filter(tc -> tc.getId().equals(testCaseId))
            .findFirst()
            .orElse(null);
    assertNotNull(testCaseFromSearch);
    assertEquals(testCaseResult, testCaseFromSearch.getTestCaseResult());

    // insert test case for a future date
    createTestCaseResult =
        new CreateTestCaseResult()
            .withResult("tested")
            .withTestCaseStatus(TestCaseStatus.Success)
            .withTimestamp(TestUtils.dateToTimestamp("2021-09-21"));
    TestCaseResult futureTestCaseResult =
        postTestCaseResult(
            testCase.getFullyQualifiedName(), createTestCaseResult, ADMIN_AUTH_HEADERS);
    testCase = getTestCase(testCase.getFullyQualifiedName(), queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(futureTestCaseResult, testCase.getTestCaseResult());

    testCaseFromSearch =
        testcases.getData().stream()
            .filter(tc -> tc.getId().equals(testCaseId))
            .findFirst()
            .orElse(null);
    assertNotNull(testCaseFromSearch);
    assertEquals(testCaseResult, testCaseFromSearch.getTestCaseResult());

    // delete the future test case
    deleteTestCaseResult(
        testCase.getFullyQualifiedName(), futureTestCaseResult.getTimestamp(), ADMIN_AUTH_HEADERS);
    testCase = getTestCase(testCase.getFullyQualifiedName(), queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(testCaseResult, testCase.getTestCaseResult());

    testCaseFromSearch =
        testcases.getData().stream()
            .filter(tc -> tc.getId().equals(testCaseId))
            .findFirst()
            .orElse(null);
    assertNotNull(testCaseFromSearch);
    assertEquals(testCaseResult, testCaseFromSearch.getTestCaseResult());
  }

  @Test
  void test_sensitivePIITestCase(TestInfo test) throws IOException {
    // First, create a table with PII Sensitive tag in a column
    TableResourceTest tableResourceTest = new TableResourceTest();
    CreateTable tableReq = getSensitiveTableReq(test, tableResourceTest);
    Table sensitiveTable = tableResourceTest.createAndCheckEntity(tableReq, ADMIN_AUTH_HEADERS);
    String sensitiveColumnLink =
        String.format("<#E::table::%s::columns::%s>", sensitiveTable.getFullyQualifiedName(), C1);

    CreateTestCase create = createRequest(test);
    create
        .withEntityLink(sensitiveColumnLink)
        .withTestDefinition(TEST_DEFINITION3.getFullyQualifiedName())
        .withParameterValues(
            List.of(new TestCaseParameterValue().withValue("100").withName("missingCountValue")));
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Owner can see the results
    Map<String, Object> queryParamsOne =
        ImmutableMap.of("limit", 10, "entityLink", sensitiveColumnLink, "fields", "*");
    ResultList<TestCase> testCases = getTestCases(queryParamsOne, authHeaders(USER1_REF.getName()));
    assertNotNull(testCases.getData().get(0).getDescription());
    assertListNotEmpty(testCases.getData().get(0).getParameterValues());

    // Owner can see the results
    Map<String, Object> queryParamsTwo =
        ImmutableMap.of("limit", 10, "entityLink", sensitiveColumnLink, "fields", "*");
    ResultList<TestCase> maskedTestCases =
        getTestCases(queryParamsTwo, authHeaders(USER2_REF.getName()));
    assertNull(maskedTestCases.getData().get(0).getDescription());
    assertEquals(0, maskedTestCases.getData().get(0).getParameterValues().size());
  }

  private CreateTable getSensitiveTableReq(TestInfo test, TableResourceTest tableResourceTest) {
    return tableResourceTest
        .createRequest(test)
        .withName(test.getDisplayName() + "_sensitiveTableTest")
        .withDatabaseSchema(DATABASE_SCHEMA.getFullyQualifiedName())
        .withOwners(List.of(USER1_REF))
        .withColumns(
            List.of(
                new Column()
                    .withName(C1)
                    .withDisplayName("c1")
                    .withDataType(ColumnDataType.VARCHAR)
                    .withDataLength(10)
                    .withTags(List.of(PII_SENSITIVE_TAG_LABEL))));
  }

  @Test
  @Order(1)
  void put_testCase_list_200(TestInfo test) throws IOException {
    List<CreateTestCase> expectedTestCaseList = new ArrayList<>();
    List<CreateTestCase> expectedColTestCaseList = new ArrayList<>();

    CreateTestCase create =
        createRequest(test)
            .withEntityLink(TABLE_LINK_2)
            .withTestDefinition(TEST_DEFINITION4.getFullyQualifiedName())
            .withParameterValues(
                List.of(new TestCaseParameterValue().withValue("100").withName("max")));
    TestCase testCase = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    expectedTestCaseList.add(create);
    CreateTestCase create1 =
        createRequest(test, 1)
            .withEntityLink(TABLE_LINK_2)
            .withTestDefinition(TEST_DEFINITION4.getFullyQualifiedName())
            .withParameterValues(
                List.of(new TestCaseParameterValue().withValue("20").withName("max")));
    createAndCheckEntity(create1, ADMIN_AUTH_HEADERS);
    expectedTestCaseList.add(create1);
    Map<String, Object> queryParams = new HashMap<>();
    queryParams.put("limit", 10);
    queryParams.put("entityLink", TABLE_LINK_2);
    queryParams.put("fields", "*");
    ResultList<TestCase> testCaseList = getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    verifyTestCases(testCaseList, expectedTestCaseList, 2);

    CreateTestCase create3 =
        createRequest(test, 2)
            .withEntityLink(TABLE_COLUMN_LINK_2)
            .withTestDefinition(TEST_DEFINITION3.getFullyQualifiedName())
            .withParameterValues(
                List.of(
                    new TestCaseParameterValue().withValue("20").withName("missingCountValue")));
    createAndCheckEntity(create3, ADMIN_AUTH_HEADERS);
    expectedColTestCaseList.add(create3);

    testCaseList = getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    verifyTestCases(testCaseList, expectedTestCaseList, 2);

    queryParams.put("entityLink", TABLE_COLUMN_LINK_2);
    testCaseList = getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    verifyTestCases(testCaseList, expectedColTestCaseList, 1);

    for (int i = 3; i < 12; i++) {
      CreateTestCase create4 =
          createRequest(test, i)
              .withEntityLink(TABLE_COLUMN_LINK_2)
              .withTestDefinition(TEST_DEFINITION3.getFullyQualifiedName())
              .withParameterValues(
                  List.of(
                      new TestCaseParameterValue().withValue("20").withName("missingCountValue")));
      createAndCheckEntity(create4, ADMIN_AUTH_HEADERS);
      expectedColTestCaseList.add(create4);
    }

    queryParams.put("entityLink", TABLE_COLUMN_LINK_2);
    testCaseList = getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    verifyTestCases(testCaseList, expectedColTestCaseList, 10);

    queryParams.put("entityLink", TABLE_LINK_2);
    queryParams.put("limit", 12);
    queryParams.put("includeAllTests", true);
    queryParams.put("include", "all");
    testCaseList = getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    expectedTestCaseList.addAll(expectedColTestCaseList);
    verifyTestCases(testCaseList, expectedTestCaseList, 12);

    queryParams.remove("includeAllTests");
    queryParams.remove("include");
    queryParams.remove("entityLink");
    queryParams.put("testSuiteId", testCase.getTestSuite().getId().toString());
    testCaseList = getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    verifyTestCases(testCaseList, expectedTestCaseList, 12);

    queryParams.clear();
    queryParams.put("limit", 10);
    queryParams.put("entityFQN", testCase.getEntityFQN());
    testCaseList = getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    testCaseList
        .getData()
        .forEach(
            tc -> assertEquals(testCase.getEntityFQN(), tc.getEntityFQN(), "Entity FQN mismatch"));
  }

  @Test
  void get_listTestCasesFromSearchWithPagination(TestInfo testInfo)
      throws IOException, ParseException {
    if (supportsSearchIndex) {
      Random rand = new Random();
      int tablesNum = rand.nextInt(3) + 3;
      int testCasesNum = rand.nextInt(7) + 3;

      TableResourceTest tableResourceTest = new TableResourceTest();
      TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();

      List<Table> tables = new ArrayList<>();
      Map<String, TestSuite> testSuites = new HashMap<>();
      int testCaseCount = 0;
      int testCaseResultCount = 0;

      for (int i = 0; i < tablesNum; i++) {
        CreateTable tableReq =
            tableResourceTest
                .createRequest(testInfo, i)
                .withDatabaseSchema(DATABASE_SCHEMA.getFullyQualifiedName())
                .withColumns(
                    List.of(
                        new Column()
                            .withName(C1)
                            .withDisplayName("c1")
                            .withDataType(ColumnDataType.VARCHAR)
                            .withDataLength(10)))
                .withOwners(List.of(USER1_REF));
        Table table = tableResourceTest.createEntity(tableReq, ADMIN_AUTH_HEADERS);
        tables.add(table);
        CreateTestSuite createTestSuite =
            testSuiteResourceTest.createRequest(table.getFullyQualifiedName());
        TestSuite testSuite =
            testSuiteResourceTest.createBasicTestSuite(createTestSuite, ADMIN_AUTH_HEADERS);
        testSuites.put(table.getFullyQualifiedName(), testSuite);
      }

      for (int i = 0; i < testCasesNum; i++) {
        String tableFQN = tables.get(rand.nextInt(tables.size())).getFullyQualifiedName();
        String testSuiteFQN = testSuites.get(tableFQN).getFullyQualifiedName();
        CreateTestCase create =
            createRequest(testInfo, i)
                .withEntityLink(String.format("<#E::table::%s>", tableFQN))
                .withTestDefinition(TEST_DEFINITION4.getFullyQualifiedName())
                .withParameterValues(
                    List.of(new TestCaseParameterValue().withValue("20").withName("min")));
        TestCase testCase = createEntity(create, ADMIN_AUTH_HEADERS);
        testCaseCount++;
        CreateTestCaseResult createTestCaseResult =
            new CreateTestCaseResult()
                .withResult("tested")
                .withTestCaseStatus(TestCaseStatus.Success)
                .withTimestamp(TestUtils.dateToTimestamp(String.format("2021-09-%02d", i)));
        postTestCaseResult(
            testCase.getFullyQualifiedName(), createTestCaseResult, ADMIN_AUTH_HEADERS);
        testCaseResultCount++;
      }
      validateEntityListFromSearchWithPagination(new HashMap<>(), testCaseCount);
    }
  }

  @Test
  void test_getSimpleListFromSearch(TestInfo testInfo) throws IOException, ParseException {
    int tablesNum = 5;
    int testCasesNum = 5;
    TableResourceTest tableResourceTest = new TableResourceTest();
    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();
    CreateTestSuite createLogicalTestSuite = testSuiteResourceTest.createRequest(testInfo);
    TestSuite logicalTestSuite =
        testSuiteResourceTest.createEntity(createLogicalTestSuite, ADMIN_AUTH_HEADERS);
    UserResourceTest userResourceTest = new UserResourceTest();
    CreateUser createUser1 =
        userResourceTest.createRequest(testInfo).withRoles(List.of(DATA_CONSUMER_ROLE.getId()));
    User user1 = userResourceTest.createEntity(createUser1, ADMIN_AUTH_HEADERS);
    EntityReference user1Ref = user1.getEntityReference();
    CreateUser createUser2 =
        userResourceTest
            .createRequest("USER_ListFromSearch")
            .withRoles(List.of(DATA_CONSUMER_ROLE.getId()));
    User user2 = userResourceTest.createEntity(createUser2, ADMIN_AUTH_HEADERS);
    EntityReference user2Ref = user2.getEntityReference();
    TeamResourceTest teamResourceTest = new TeamResourceTest();
    CreateTeam createTeam = teamResourceTest.createRequest(testInfo, 1).withTeamType(GROUP);
    Team team = teamResourceTest.createEntity(createTeam, ADMIN_AUTH_HEADERS);
    EntityReference teamRef = team.getEntityReference();

    List<Table> tables = new ArrayList<>();
    Map<String, TestSuite> testSuites = new HashMap<>();
    List<TestCase> testCases = new ArrayList<>();

    for (int i = 0; i < tablesNum; i++) {
      CreateTable tableReq;
      // Add entity FQN with same prefix to validate listing
      // with AllTest=true returns all columns and table test for the
      // specific entityFQN (and does not include tests from the other entityFQN
      // with the same prefix
      if (i == 0) {
        tableReq = tableResourceTest.createRequest("test_getSimpleListFromSearch");
        tableReq.setTags(List.of(PERSONAL_DATA_TAG_LABEL));
      } else if (i == 1) {
        tableReq = tableResourceTest.createRequest("test_getSimpleListFromSearch_a");
        tableReq.setTags(List.of(PII_SENSITIVE_TAG_LABEL, TIER1_TAG_LABEL));
      } else {
        tableReq = tableResourceTest.createRequest(testInfo, i);
      }
      tableReq
          .withDatabaseSchema(DATABASE_SCHEMA.getFullyQualifiedName())
          .withColumns(
              List.of(
                  new Column()
                      .withName(C1)
                      .withDisplayName("c1")
                      .withDataType(ColumnDataType.VARCHAR)
                      .withDataLength(10)))
          .withOwners(List.of(user1Ref));
      Table table = tableResourceTest.createEntity(tableReq, ADMIN_AUTH_HEADERS);
      tables.add(table);
      CreateTestSuite createTestSuite =
          testSuiteResourceTest.createRequest(table.getFullyQualifiedName());
      TestSuite testSuite =
          testSuiteResourceTest.createBasicTestSuite(createTestSuite, ADMIN_AUTH_HEADERS);
      testSuites.put(table.getFullyQualifiedName(), testSuite);
    }

    for (int i = 0; i < testCasesNum; i++) {
      String tableFQN = tables.get(i).getFullyQualifiedName();
      CreateTestCase create =
          createRequest(testInfo, i)
              .withEntityLink(String.format("<#E::table::%s>", tableFQN))
              .withTestDefinition(TEST_DEFINITION4.getFullyQualifiedName())
              .withParameterValues(
                  List.of(new TestCaseParameterValue().withValue("20").withName("max")));
      if (i == 2) {
        // create 1 test cases with USER21_TEAM as owner
        create.withOwners(List.of(teamRef));
      } else if (i % 2 == 0) {
        // create 2 test cases with USER1_REF as owner
        create.withOwners(List.of(user2Ref));
      }
      TestCase testCase = createEntity(create, ADMIN_AUTH_HEADERS);
      testCases.add(testCase);
      CreateTestCaseResult createTestCaseResult =
          new CreateTestCaseResult()
              .withResult("tested")
              .withTestCaseStatus(TestCaseStatus.Success)
              .withTimestamp(TestUtils.dateToTimestamp(String.format("2021-09-%02d", i)));
      postTestCaseResult(
          testCase.getFullyQualifiedName(), createTestCaseResult, ADMIN_AUTH_HEADERS);
    }
    TestCase testCaseForEL = testCases.get(0);
    testSuiteResourceTest.addTestCasesToLogicalTestSuite(
        logicalTestSuite, List.of(testCaseForEL.getId()));

    Map<String, String> queryParams = new HashMap<>();
    ResultList<TestCase> allEntities =
        listEntitiesFromSearch(queryParams, testCasesNum, 0, ADMIN_AUTH_HEADERS);
    assertEquals(testCasesNum, allEntities.getData().size());
    queryParams.put(
        "queryString",
        "%7B%22query%22%3A%20%7B%22term%22%3A%20%7B%22id%22%3A%20%22"
            + testCaseForEL.getId()
            + "%22%7D%7D%7D");
    allEntities = listEntitiesFromSearch(queryParams, testCasesNum, 0, ADMIN_AUTH_HEADERS);
    // Note: Since the "name" field and its ngram variant are  prioritized in the search query
    // and the test case names are very similar, the fuzzy matching returns all test cases.
    Assertions.assertTrue(
        allEntities.getData().stream()
            .allMatch(
                ts -> ts.getFullyQualifiedName().equals(testCaseForEL.getFullyQualifiedName())));

    queryParams.clear();
    queryParams.put("q", "test_getSimpleListFromSearchb");
    allEntities = listEntitiesFromSearch(queryParams, testCasesNum, 0, ADMIN_AUTH_HEADERS);
    // Note: Since the "name" field and its ngram variant are  prioritized in the search query
    // and the test case names are very similar, the fuzzy matching returns all test cases.
    assertEquals(testCasesNum, allEntities.getData().size());

    queryParams.clear();
    queryParams.put("entityLink", testCaseForEL.getEntityLink());
    queryParams.put("includeAllTests", "true");
    allEntities = listEntitiesFromSearch(queryParams, testCasesNum, 0, ADMIN_AUTH_HEADERS);
    assertEquals(1, allEntities.getData().size());
    assertThat(allEntities.getData().get(0).getEntityLink())
        .contains(testCaseForEL.getEntityLink());

    queryParams.clear();
    queryParams.put("testPlatforms", TestPlatform.DEEQU.value());
    allEntities = listEntitiesFromSearch(queryParams, testCasesNum, 0, ADMIN_AUTH_HEADERS);
    assertEquals(
        0, allEntities.getData().size()); // we don't have any test cases with DEEQU platform

    queryParams.clear();
    queryParams.put("testPlatforms", TestPlatform.OPEN_METADATA.value());
    allEntities = listEntitiesFromSearch(queryParams, testCasesNum, 0, ADMIN_AUTH_HEADERS);
    assertEquals(
        testCasesNum,
        allEntities.getData().size()); // we have all test cases with OPEN_METADATA platform

    queryParams.clear();
    queryParams.put(
        "testPlatforms", String.format("%s,%s", TestPlatform.OPEN_METADATA, TestPlatform.DEEQU));
    allEntities = listEntitiesFromSearch(queryParams, testCasesNum, 0, ADMIN_AUTH_HEADERS);
    assertEquals(
        testCasesNum, allEntities.getData().size()); // Should return either values matching

    queryParams.clear();
    queryParams.put("owner", user2Ref.getName());
    allEntities = listEntitiesFromSearch(queryParams, testCasesNum, 0, ADMIN_AUTH_HEADERS);
    assertEquals(2, allEntities.getData().size()); // we have 2 test cases with user2Ref as owner ,
    // patch_entityUpdateOwnerFromNull_200 also adds owner
    allEntities
        .getData()
        .forEach(
            tc -> {
              assertTrue(
                  tc.getOwners().stream().anyMatch(owner -> owner.getId().equals(user2Ref.getId())),
                  String.format(
                      "Test case %s does not contain the expected owner %s",
                      tc.getName(), user2Ref.getName()));
            });

    queryParams.put("owner", team.getName());
    allEntities = listEntitiesFromSearch(queryParams, testCasesNum, 0, ADMIN_AUTH_HEADERS);
    assertEquals(
        1,
        allEntities
            .getData()
            .size()); // we have 1 test cases with TEAM21 as owner which USER_21 is part of

    queryParams.clear();
    queryParams.put("fields", "tags");
    queryParams.put(
        "tags",
        String.format(
            "%s,%s", PII_SENSITIVE_TAG_LABEL.getTagFQN(), PERSONAL_DATA_TAG_LABEL.getTagFQN()));
    allEntities = listEntitiesFromSearch(queryParams, testCasesNum, 0, ADMIN_AUTH_HEADERS);
    // check we don't have any list of tags that doesn't have PII_SENSITIVE_TAG_LABEL or
    // PERSONAL_DATA_TAG_LABEL for all test cases
    allEntities
        .getData()
        .forEach(
            tc ->
                assertFalse(
                    tc.getTags().stream()
                        .noneMatch(
                            t ->
                                t.getTagFQN()
                                    .matches(
                                        String.format(
                                            "(%s|%s)",
                                            PII_SENSITIVE_TAG_LABEL.getTagFQN(),
                                            PERSONAL_DATA_TAG_LABEL.getTagFQN())))));

    queryParams.put("tags", PERSONAL_DATA_TAG_LABEL.getTagFQN());
    allEntities = listEntitiesFromSearch(queryParams, testCasesNum, 0, ADMIN_AUTH_HEADERS);
    // check we have all test cases with PERSONAL_DATA_TAG_LABEL
    allEntities
        .getData()
        .forEach(
            tc ->
                assertTrue(
                    tc.getTags().stream()
                        .anyMatch(
                            t -> t.getTagFQN().contains(PERSONAL_DATA_TAG_LABEL.getTagFQN()))));

    queryParams.clear();
    queryParams.put("tier", TIER1_TAG_LABEL.getTagFQN());
    queryParams.put("fields", "tags");
    allEntities = listEntitiesFromSearch(queryParams, testCasesNum, 0, ADMIN_AUTH_HEADERS);
    // check we have all test cases with TIER1_TAG_LABEL
    allEntities
        .getData()
        .forEach(
            tc ->
                assertTrue(
                    tc.getTags().stream()
                        .anyMatch(t -> t.getTagFQN().contains(TIER1_TAG_LABEL.getTagFQN()))));

    queryParams.clear();
    String serviceName = tables.get(0).getService().getName();
    queryParams.put("serviceName", serviceName);
    allEntities = listEntitiesFromSearch(queryParams, testCasesNum, 0, ADMIN_AUTH_HEADERS);
    assertTrue(
        allEntities.getData().stream().allMatch(tc -> tc.getEntityLink().contains(serviceName)));

    // Test return only requested fields
    queryParams.put("includeFields", "id,name,entityLink");
    allEntities = listEntitiesFromSearch(queryParams, testCasesNum, 0, ADMIN_AUTH_HEADERS);
    TestCase testCase = allEntities.getData().get(0);
    assertNull(testCase.getDescription());
    assertNull(testCase.getTestSuite());
    assertNotNull(testCase.getEntityLink());
    assertNotNull(testCase.getName());
    assertNotNull(testCase.getId());

    // Test return only the specified dimension
    queryParams.clear();
    queryParams.put("dataQualityDimension", "Completeness");
    allEntities = listEntitiesFromSearch(queryParams, testCasesNum, 0, ADMIN_AUTH_HEADERS);
    assertNotEquals(0, allEntities.getData().size());

    // Test return only the specified test suite ID (Executable)
    queryParams.clear();
    TestSuite testSuite = testSuites.get(tables.get(0).getFullyQualifiedName());
    queryParams.put("testSuiteId", testSuite.getId().toString());
    queryParams.put("fields", "testSuites");
    allEntities = listEntitiesFromSearch(queryParams, testCasesNum, 0, ADMIN_AUTH_HEADERS);
    testCases = allEntities.getData();
    assertNotEquals(0, testCases.size());
    assertTrue(
        testCases.stream()
            .allMatch(
                tc ->
                    tc.getTestSuites().stream()
                        .anyMatch(ts -> ts.getId().equals(testSuite.getId()))));

    // Test return only the specified test suite ID (Logical)
    queryParams.put("testSuiteId", logicalTestSuite.getId().toString());
    queryParams.put("fields", "testSuites");
    allEntities = listEntitiesFromSearch(queryParams, testCasesNum, 0, ADMIN_AUTH_HEADERS);
    testCases = allEntities.getData();
    assertNotEquals(0, testCases.size());
    assertTrue(
        testCases.stream()
            .allMatch(
                tc ->
                    tc.getTestSuites().stream()
                        .anyMatch(ts -> ts.getId().equals(logicalTestSuite.getId()))));
  }

  @Test
  void test_testCaseInheritedFields(TestInfo testInfo) throws IOException {
    // Set up the test case
    TableResourceTest tableResourceTest = new TableResourceTest();
    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();
    CreateTable createTable = tableResourceTest.createRequest(testInfo);
    String columnName = RandomStringUtils.random(10, true, false);
    createTable
        .withDatabaseSchema(DATABASE_SCHEMA.getFullyQualifiedName())
        .withColumns(
            List.of(
                new Column()
                    .withName(columnName)
                    .withDisplayName(columnName)
                    .withDataType(ColumnDataType.VARCHAR)
                    .withDataLength(10)
                    .withTags(List.of(PII_SENSITIVE_TAG_LABEL))))
        .withOwners(List.of(USER1_REF))
        .withDomain(DOMAIN1.getFullyQualifiedName())
        .withTableConstraints(List.of())
        .withTags(List.of(PERSONAL_DATA_TAG_LABEL, TIER1_TAG_LABEL));
    Table table = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);
    CreateTestSuite createTestSuite =
        testSuiteResourceTest.createRequest(table.getFullyQualifiedName());
    TestSuite testSuite =
        testSuiteResourceTest.createBasicTestSuite(createTestSuite, ADMIN_AUTH_HEADERS);

    CreateTestCase create =
        createRequest(testInfo)
            .withEntityLink(String.format("<#E::table::%s>", table.getFullyQualifiedName()))
            .withTestDefinition(TEST_DEFINITION4.getFullyQualifiedName())
            .withParameterValues(
                List.of(new TestCaseParameterValue().withValue("20").withName("min")));
    createEntity(create, ADMIN_AUTH_HEADERS);
    create =
        createRequest(testInfo)
            .withEntityLink(
                String.format(
                    "<#E::table::%s::columns::%s>", table.getFullyQualifiedName(), columnName))
            .withTestDefinition(TEST_DEFINITION3.getFullyQualifiedName())
            .withParameterValues(
                List.of(
                    new TestCaseParameterValue().withValue("20").withName("missingCountValue")));
    createEntity(create, ADMIN_AUTH_HEADERS);

    // Run the tests assertions
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("entityLink", String.format("<#E::table::%s>", table.getFullyQualifiedName()));
    queryParams.put("includeAllTests", "true");
    queryParams.put("fields", "domain,owners,tags");
    ResultList<TestCase> testCases = listEntitiesFromSearch(queryParams, 10, 0, ADMIN_AUTH_HEADERS);
    assertEquals(2, testCases.getData().size());
    for (TestCase testCase : testCases.getData()) {
      assertOwners(table.getOwners(), testCase.getOwners());
      assertEquals(table.getDomain().getId(), testCase.getDomain().getId());
      List<TagLabel> tags = testCase.getTags();
      HashSet<String> actualTags =
          tags.stream().map(TagLabel::getName).collect(Collectors.toCollection(HashSet::new));
      HashSet<String> expectedTags;
      if (testCase.getEntityLink().contains(columnName)) {
        expectedTags =
            new HashSet<>(
                List.of(
                    PERSONAL_DATA_TAG_LABEL.getName(),
                    TIER1_TAG_LABEL.getName(),
                    PII_SENSITIVE_TAG_LABEL.getName()));
      } else {
        expectedTags =
            new HashSet<>(List.of(PERSONAL_DATA_TAG_LABEL.getName(), TIER1_TAG_LABEL.getName()));
      }
      assertEquals(expectedTags, actualTags);
    }

    createTable.setOwners(List.of(USER2_REF));
    createTable.setDomain(DOMAIN.getFullyQualifiedName());
    createTable.setTags(List.of(USER_ADDRESS_TAG_LABEL));
    createTable.withColumns(
        List.of(
            new Column()
                .withName(columnName)
                .withDisplayName("c1")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(10)
                .withTags(List.of(PERSONAL_DATA_TAG_LABEL))));
    table = tableResourceTest.updateEntity(createTable, OK, ADMIN_AUTH_HEADERS);
    testCases = listEntitiesFromSearch(queryParams, 10, 0, ADMIN_AUTH_HEADERS);

    for (TestCase testCase : testCases.getData()) {
      assertOwners(table.getOwners(), testCase.getOwners());
      assertEquals(table.getDomain().getId(), testCase.getDomain().getId());
    }
  }

  @Test
  void test_getTestCaseWithTagsField(TestInfo testInfo) throws IOException {
    // Create a table with tags
    TableResourceTest tableResourceTest = new TableResourceTest();
    String columnName = "taggedColumn";
    CreateTable createTable = tableResourceTest.createRequest(testInfo);
    createTable.setDatabaseSchema(DATABASE_SCHEMA.getFullyQualifiedName());
    List<Column> columns = new ArrayList<>(createTable.getColumns());
    columns.addAll(
        List.of(
            new Column()
                .withName(columnName)
                .withDisplayName(columnName)
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(10)
                .withTags(List.of(PII_SENSITIVE_TAG_LABEL)),
            new Column()
                .withName("normalColumn")
                .withDisplayName("normalColumn")
                .withDataType(ColumnDataType.BIGINT)));
    createTable.setColumns(columns);
    createTable.setTags(List.of(PERSONAL_DATA_TAG_LABEL));

    Table table = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Create test cases - one for table level, one for column level
    CreateTestCase tableTestCase =
        createRequest(testInfo)
            .withName("tableTestCaseWithTags")
            .withEntityLink(String.format("<#E::table::%s>", table.getFullyQualifiedName()))
            .withTags(List.of(TIER1_TAG_LABEL))
            .withTestDefinition(TEST_DEFINITION4.getFullyQualifiedName());
    TestCase createdTableTestCase = createEntity(tableTestCase, ADMIN_AUTH_HEADERS);

    CreateTestCase columnTestCase =
        createRequest(testInfo)
            .withName("columnTestCaseWithTags")
            .withEntityLink(
                String.format(
                    "<#E::table::%s::columns::%s>", table.getFullyQualifiedName(), columnName))
            .withTestDefinition(TEST_DEFINITION3.getFullyQualifiedName())
            .withTags(List.of(TIER1_TAG_LABEL))
            .withParameterValues(
                List.of(
                    new TestCaseParameterValue().withValue("10").withName("missingCountValue")));
    TestCase createdColumnTestCase = createEntity(columnTestCase, ADMIN_AUTH_HEADERS);

    // Test 1: Get table-level test case by ID with tags field
    TestCase fetchedTableTestCase =
        getEntity(createdTableTestCase.getId(), "tags", ADMIN_AUTH_HEADERS);
    assertNotNull(fetchedTableTestCase.getTags());
    assertEquals(2, fetchedTableTestCase.getTags().size());
    Set<String> tableTestCaseTags =
        fetchedTableTestCase.getTags().stream().map(TagLabel::getName).collect(Collectors.toSet());
    assertTrue(tableTestCaseTags.contains(PERSONAL_DATA_TAG_LABEL.getName()));
    assertTrue(tableTestCaseTags.contains(TIER1_TAG_LABEL.getName()));

    // Test 2: Get column-level test case by ID with tags field
    TestCase fetchedColumnTestCase =
        getEntity(createdColumnTestCase.getId(), "tags", ADMIN_AUTH_HEADERS);
    assertNotNull(fetchedColumnTestCase.getTags());
    assertEquals(3, fetchedColumnTestCase.getTags().size());
    Set<String> columnTestCaseTags =
        fetchedColumnTestCase.getTags().stream().map(TagLabel::getName).collect(Collectors.toSet());
    assertTrue(columnTestCaseTags.contains(TIER1_TAG_LABEL.getName()));
    assertTrue(columnTestCaseTags.contains(PII_SENSITIVE_TAG_LABEL.getName()));

    // Test 3: Get test case by name with tags field
    TestCase fetchedByName =
        getEntityByName(createdTableTestCase.getFullyQualifiedName(), "tags", ADMIN_AUTH_HEADERS);
    assertNotNull(fetchedByName.getTags());
    assertEquals(2, fetchedByName.getTags().size());

    // Test 4: Verify tags are not included when not requested
    TestCase withoutTags = getEntity(createdTableTestCase.getId(), null, ADMIN_AUTH_HEADERS);
    assertTrue(nullOrEmpty(withoutTags.getTags()));
  }

  @Test
  @Override
  public void post_entity_as_non_admin_401(TestInfo test) {
    // Override the default behavior where entities are created vs. for test case
    // the operation is the entity to which tests are attached is edited
    assertResponse(
        () -> createEntity(createRequest(test), TEST_AUTH_HEADERS),
        FORBIDDEN,
        "User does not have ANY of the required permissions.");
  }

  @Test
  void post_put_patch_delete_testCase_table_owner(TestInfo test) throws IOException {
    // Table owner should be able to create, update, and delete tests
    Map<String, String> ownerAuthHeaders = authHeaders(USER1_REF.getName());
    TestCase testCase = createAndCheckEntity(createRequest(test), ownerAuthHeaders);

    // Update description with PUT
    String oldDescription = testCase.getDescription();
    String newDescription = "description1";
    ChangeDescription change = getChangeDescription(testCase, MINOR_UPDATE);
    fieldUpdated(change, "description", oldDescription, newDescription);
    testCase =
        updateAndCheckEntity(
            createRequest(test).withDescription(newDescription).withName(testCase.getName()),
            OK,
            ownerAuthHeaders,
            MINOR_UPDATE,
            change);

    // Update description with PATCH
    // Changes from this PATCH is consolidated with the previous changes
    newDescription = "description2";
    change = getChangeDescription(testCase, MINOR_UPDATE);
    change.setPreviousVersion(testCase.getVersion());
    fieldUpdated(change, "description", "description1", newDescription);
    String json = JsonUtils.pojoToJson(testCase);
    testCase.setDescription(newDescription);
    testCase = patchEntityAndCheck(testCase, json, ownerAuthHeaders, MINOR_UPDATE, change);

    // Delete the testcase
    deleteAndCheckEntity(testCase, ownerAuthHeaders);
  }

  @Test
  @Override
  public void delete_entity_as_non_admin_401(TestInfo test) throws HttpResponseException {
    // Override the default behavior where entities are deleted vs. for test case
    // the operation is the entity to which tests are attached is edited
    CreateTestCase request = createRequest(getEntityName(test), "", "", null);
    TestCase entity = createEntity(request, ADMIN_AUTH_HEADERS);
    assertResponse(
        () -> deleteAndCheckEntity(entity, TEST_AUTH_HEADERS),
        FORBIDDEN,
        permissionNotAllowed(TEST_USER_NAME, List.of(DELETE)));
  }

  @Test
  void add_EmptyTestCaseToLogicalTestSuite_200(TestInfo test) throws IOException {
    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();
    // Create a logical Test Suite
    CreateTestSuite createLogicalTestSuite = testSuiteResourceTest.createRequest(test);
    TestSuite logicalTestSuite =
        testSuiteResourceTest.createEntity(createLogicalTestSuite, ADMIN_AUTH_HEADERS);

    testSuiteResourceTest.addTestCasesToLogicalTestSuite(logicalTestSuite, new ArrayList<>());
  }

  @Test
  void delete_testCaseFromLogicalTestSuite(TestInfo test) throws IOException {
    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();
    // Create a logical Test Suite
    CreateTestSuite createLogicalTestSuite = testSuiteResourceTest.createRequest(test);
    TestSuite logicalTestSuite =
        testSuiteResourceTest.createEntity(createLogicalTestSuite, ADMIN_AUTH_HEADERS);

    List<TestCase> testCases = new ArrayList<>();

    // Create the test cases (need to be created against an executable test suite)
    for (int i = 0; i < 5; i++) {
      CreateTestCase create = createRequest("test_testSuite__" + i);
      TestCase testCase = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
      testCases.add(testCase);
    }

    // Add the test cases to the logical test suite
    testSuiteResourceTest.addTestCasesToLogicalTestSuite(
        logicalTestSuite, testCases.stream().map(TestCase::getId).collect(Collectors.toList()));

    // Verify that the test cases are in the logical test suite
    Map<String, Object> queryParams = new HashMap<>();
    queryParams.put("limit", 100);
    queryParams.put("fields", "*");
    queryParams.put("testSuiteId", logicalTestSuite.getId().toString());
    ResultList<TestCase> logicalTestSuiteTestCases = getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(testCases.size(), logicalTestSuiteTestCases.getData().size());

    // Delete a logical test case and check that it is deleted from the logical test suite but not
    // from the executable test suite
    UUID logicalTestCaseIdToDelete = testCases.get(0).getId();
    deleteLogicalTestCase(logicalTestSuite, logicalTestCaseIdToDelete);
    logicalTestSuiteTestCases = getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    assertTrue(assertTestCaseIdNotInList(logicalTestSuiteTestCases, logicalTestCaseIdToDelete));

    String testSuiteID = testCases.get(0).getTestSuite().getId().toString();

    queryParams.put("testSuiteId", testSuiteID);
    ResultList<TestCase> executableTestSuiteTestCases =
        getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    Integer initialSize = executableTestSuiteTestCases.getData().size();
    assertTrue(
        executableTestSuiteTestCases.getData().stream()
            .allMatch(t -> t.getTestSuite().getId().toString().equals(testSuiteID)));

    // Soft Delete a test case from the executable test suite and check that it is deleted from the
    // executable test suite and from the logical test suite
    UUID executableTestCaseIdToDelete = testCases.get(1).getId();
    deleteEntity(executableTestCaseIdToDelete, false, false, ADMIN_AUTH_HEADERS);
    queryParams.put("testSuiteId", logicalTestSuite.getId().toString());
    logicalTestSuiteTestCases = getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(3, logicalTestSuiteTestCases.getData().size());
    assertTrue(assertTestCaseIdNotInList(logicalTestSuiteTestCases, executableTestCaseIdToDelete));

    queryParams.put("includeAllTests", true);
    queryParams.put("include", "all");
    logicalTestSuiteTestCases = getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(4, logicalTestSuiteTestCases.getData().size());

    queryParams.put("testSuiteId", testSuiteID);
    queryParams.remove("includeAllTests");
    queryParams.remove("include");
    executableTestSuiteTestCases = getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(initialSize - 1, executableTestSuiteTestCases.getData().size());
    assertTrue(
        assertTestCaseIdNotInList(executableTestSuiteTestCases, executableTestCaseIdToDelete));

    queryParams.put("includeAllTests", true);
    queryParams.put("include", "all");
    executableTestSuiteTestCases = getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    boolean hasDeletedTrue = false;
    boolean hasDeletedFalse = false;
    for (TestCase testCase : executableTestSuiteTestCases.getData()) {
      if (!hasDeletedTrue && testCase.getDeleted()) {
        hasDeletedTrue = true;
      } else if (!hasDeletedFalse && !testCase.getDeleted()) {
        hasDeletedFalse = true;
      }
    }
    assertTrue(
        hasDeletedTrue
            && hasDeletedFalse); // We should have both deleted and non-deleted test cases in the
    // executable test suite

    // Hard Delete a test case from the executable test suite and check that it is deleted from the
    // executable test suite and from the logical test suite
    deleteEntity(executableTestCaseIdToDelete, false, true, ADMIN_AUTH_HEADERS);

    queryParams.put("testSuiteId", logicalTestSuite.getId().toString());
    logicalTestSuiteTestCases = getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    assertTrue(
        logicalTestSuiteTestCases.getData().stream()
            .allMatch(
                t -> {
                  List<TestSuite> testSuites = t.getTestSuites();
                  return testSuites.stream()
                      .anyMatch(
                          ts -> ts.getId().toString().equals(logicalTestSuite.getId().toString()));
                }));
    assertTrue(assertTestCaseIdNotInList(logicalTestSuiteTestCases, executableTestCaseIdToDelete));

    queryParams.put("testSuiteId", testSuiteID);
    executableTestSuiteTestCases = getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    assertTrue(
        executableTestSuiteTestCases.getData().stream()
            .allMatch(
                t -> {
                  List<TestSuite> testSuites = t.getTestSuites();
                  return testSuites.stream()
                      .anyMatch(ts -> ts.getId().toString().equals(testSuiteID));
                }));
    assertTrue(
        assertTestCaseIdNotInList(executableTestSuiteTestCases, executableTestCaseIdToDelete));
  }

  @Test
  void list_allTestSuitesFromTestCase_200(TestInfo test) throws IOException {
    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();
    // Create a logical Test Suite
    CreateTestSuite createLogicalTestSuite = testSuiteResourceTest.createRequest(test);
    TestSuite logicalTestSuite =
        testSuiteResourceTest.createEntity(createLogicalTestSuite, ADMIN_AUTH_HEADERS);

    // Create the test cases (need to be created against an executable test suite)
    CreateTestCase create = createRequest("test_testSuite__" + test.getDisplayName());
    TestCase testCase = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    List<UUID> testCaseIds = listOf(testCase.getId());

    // Add the test cases to the logical test suite
    testSuiteResourceTest.addTestCasesToLogicalTestSuite(logicalTestSuite, testCaseIds);

    TestCase testCaseWithSuites =
        getEntityByName(testCase.getFullyQualifiedName(), "*", ADMIN_AUTH_HEADERS);
    assertEquals(
        testCase.getTestSuite().getFullyQualifiedName(),
        testCaseWithSuites.getTestSuite().getFullyQualifiedName());
    assertEquals(2, testCaseWithSuites.getTestSuites().size());

    // Verify both our testSuites are in the list of TestSuite Entities
    Map<String, EntityReference> testSuiteFQNs = new HashMap<>();
    testSuiteFQNs.put(
        logicalTestSuite.getFullyQualifiedName(), logicalTestSuite.getEntityReference());
    testSuiteFQNs.put(testCase.getTestSuite().getFullyQualifiedName(), testCase.getTestSuite());

    for (TestSuite testSuite : testCaseWithSuites.getTestSuites()) {
      assertNotNull(testSuiteFQNs.get(testSuite.getFullyQualifiedName()));
    }
  }

  @Test
  void post_createTestCaseResultFailure(TestInfo test)
      throws HttpResponseException, ParseException {
    // We're going to check how each test only has a single open stateID
    // and 2 tests have their own flow
    Long startTs = System.currentTimeMillis();
    TestCase testCaseEntity1 = createEntity(createRequest(getEntityName(test)), ADMIN_AUTH_HEADERS);
    TestCase testCaseEntity2 =
        createEntity(createRequest(getEntityName(test) + "2"), ADMIN_AUTH_HEADERS);

    // Add a failed result, which will create a NEW incident and add a new status
    for (TestCase testCase : List.of(testCaseEntity1, testCaseEntity2)) {
      postTestCaseResult(
          testCase.getFullyQualifiedName(),
          new CreateTestCaseResult()
              .withResult("result")
              .withTestCaseStatus(TestCaseStatus.Failed)
              .withTimestamp(TestUtils.dateToTimestamp("2024-01-01")),
          ADMIN_AUTH_HEADERS);

      CreateTestCaseResolutionStatus createAckIncident =
          new CreateTestCaseResolutionStatus()
              .withTestCaseReference(testCase.getFullyQualifiedName())
              .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.Ack)
              .withTestCaseResolutionStatusDetails(null);
      createTestCaseFailureStatus(createAckIncident);
    }
    Long endTs = System.currentTimeMillis();

    // Get the test case failure statuses
    ResultList<TestCaseResolutionStatus> testCaseFailureStatusResultList =
        getTestCaseFailureStatus(startTs, endTs, null, null);
    assertEquals(4, testCaseFailureStatusResultList.getData().size());

    List<TestCaseResolutionStatus> ackStatuses =
        testCaseFailureStatusResultList.getData().stream()
            .filter(
                status ->
                    status
                        .getTestCaseResolutionStatusType()
                        .equals(TestCaseResolutionStatusTypes.Ack))
            .toList();

    ackStatuses.stream()
        .flatMap(status -> status.getMetrics().stream())
        .filter(metric -> metric.getName().equals("timeToResponse"))
        .forEach(metric -> assertNotNull(metric.getValue()));

    // check we have only 2 distinct sequence IDs, one for each test case
    List<UUID> stateIds =
        testCaseFailureStatusResultList.getData().stream()
            .map(TestCaseResolutionStatus::getStateId)
            .toList();
    Set<UUID> stateIdSet = new HashSet<>(stateIds);
    assertEquals(2, stateIdSet.size());

    TestCaseResolutionStatus testCaseResolutionStatus =
        testCaseFailureStatusResultList.getData().get(0);
    UUID stateId = stateIds.get(0);

    // Get the test case failure statuses by ID
    TestCaseResolutionStatus storedTestCaseResolution =
        getTestCaseFailureStatusById(testCaseResolutionStatus.getId());
    assertEquals(storedTestCaseResolution.getId(), testCaseResolutionStatus.getId());

    // Get the test case failure statuses by sequence ID
    ResultList<TestCaseResolutionStatus> storedTestCaseResolutions =
        getTestCaseFailureStatusByStateId(stateId);
    assertEquals(2, storedTestCaseResolutions.getData().size());
    assertEquals(stateId, storedTestCaseResolutions.getData().get(0).getStateId());

    // Get the test case resolution statuses by status type
    storedTestCaseResolutions =
        getTestCaseFailureStatus(startTs, endTs, null, TestCaseResolutionStatusTypes.Ack);
    assertEquals(2, storedTestCaseResolutions.getData().size());
    assertEquals(
        TestCaseResolutionStatusTypes.Ack,
        storedTestCaseResolutions.getData().get(0).getTestCaseResolutionStatusType());

    // Get the test case resolution by FQN
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("testCaseFQN", TEST_TABLE1.getFullyQualifiedName());
    storedTestCaseResolutions = getTestCaseFailureStatus(startTs, endTs, null, null, queryParams);
    assertTrue(
        storedTestCaseResolutions.getData().stream()
            .allMatch(
                t ->
                    t.getTestCaseReference()
                        .getFullyQualifiedName()
                        .equals(testCaseEntity1.getFullyQualifiedName())));

    // Get the test case resolution by origin entity FQN
    queryParams.clear();
    queryParams.put("originEntityFQN", TEST_TABLE1.getFullyQualifiedName());
    storedTestCaseResolutions = getTestCaseFailureStatus(startTs, endTs, null, null, queryParams);
    for (TestCaseResolutionStatus testCaseResolution : storedTestCaseResolutions.getData()) {
      EntityReference testCaseReference = testCaseResolution.getTestCaseReference();
      TestCase testCase = getEntity(testCaseReference.getId(), ADMIN_AUTH_HEADERS);
      MessageParser.EntityLink entityLink =
          MessageParser.EntityLink.parse(testCase.getEntityLink());
      assertEquals(entityLink.getEntityFQN(), TEST_TABLE1.getFullyQualifiedName());
    }

    queryParams.put("originEntityFQN", "IDONOTEXIST123");
    storedTestCaseResolutions = getTestCaseFailureStatus(startTs, endTs, null, null, queryParams);
    assertEquals(0, storedTestCaseResolutions.getData().size());

    // Delete test case recursively and check that the test case resolution status is also deleted
    // 1. soft delete - should not delete the test case resolution status
    // 2. hard delete - should delete the test case resolution status
    deleteEntity(testCaseEntity1.getId(), true, false, ADMIN_AUTH_HEADERS);
    queryParams.clear();
    queryParams.put("include", "all");
    storedTestCaseResolutions =
        getTestCaseFailureStatus(
            startTs, endTs, null, TestCaseResolutionStatusTypes.Ack, queryParams);
    assertEquals(2, storedTestCaseResolutions.getData().size());
    assertTrue(
        storedTestCaseResolutions.getData().stream()
            .anyMatch(t -> t.getTestCaseReference().getId().equals(testCaseEntity1.getId())));

    deleteEntity(testCaseEntity1.getId(), true, true, ADMIN_AUTH_HEADERS);
    storedTestCaseResolutions =
        getTestCaseFailureStatus(startTs, endTs, null, TestCaseResolutionStatusTypes.Ack);
    assertEquals(1, storedTestCaseResolutions.getData().size());
    assertTrue(
        storedTestCaseResolutions.getData().stream()
            .noneMatch(t -> t.getTestCaseReference().getId().equals(testCaseEntity1.getId())));
  }

  @Test
  void test_listTestCaseFailureStatusPagination(TestInfo test) throws IOException, ParseException {
    // Create a number of entities between 5 and 20 inclusive
    Random rand = new Random();
    int maxEntities = rand.nextInt(16) + 5;

    Long startTs = System.currentTimeMillis() - 1000;
    for (int i = 0; i < maxEntities; i++) {
      // We'll create random test cases
      TestCase testCaseEntity =
          createEntity(createRequest(getEntityName(test) + i), ADMIN_AUTH_HEADERS);
      // Adding failed test case, which will create a NEW incident
      postTestCaseResult(
          testCaseEntity.getFullyQualifiedName(),
          new CreateTestCaseResult()
              .withResult("result")
              .withTestCaseStatus(TestCaseStatus.Failed)
              .withTimestamp(TestUtils.dateToTimestamp("2024-01-01")),
          ADMIN_AUTH_HEADERS);
    }
    Long endTs = System.currentTimeMillis() + 1000;

    // List all entities and use it for checking pagination
    ResultList<TestCaseResolutionStatus> allEntities =
        getTestCaseFailureStatus(1000000, null, false, startTs, endTs, null);

    paginateTestCaseFailureStatus(maxEntities, allEntities, startTs, endTs);
  }

  @Test
  void test_listTestCaseFailureStatusDeletedTestCase(TestInfo test)
      throws IOException, ParseException {
    List<TestCase> testCases = new ArrayList<>();
    Long startTs = System.currentTimeMillis() - 1000;
    for (int i = 0; i < 2; i++) {
      // We'll create random test cases
      TestCase testCaseEntity =
          createEntity(createRequest(getEntityName(test) + i), ADMIN_AUTH_HEADERS);
      testCases.add(testCaseEntity);
      // Adding failed test case, which will create a NEW incident
      postTestCaseResult(
          testCaseEntity.getFullyQualifiedName(),
          new CreateTestCaseResult()
              .withResult("result")
              .withTestCaseStatus(TestCaseStatus.Failed)
              .withTimestamp(TestUtils.dateToTimestamp("2024-01-01")),
          ADMIN_AUTH_HEADERS);
    }
    Long endTs = System.currentTimeMillis() + 1000;
    ResultList<TestCaseResolutionStatus> entities =
        getTestCaseFailureStatus(1000, null, false, startTs, endTs, null);
    assertTrue(
        entities.getData().stream()
            .anyMatch(
                tcrs -> tcrs.getTestCaseReference().getId().equals(testCases.get(0).getId())));
    deleteEntityByName(testCases.get(0).getFullyQualifiedName(), true, false, ADMIN_AUTH_HEADERS);
    entities = getTestCaseFailureStatus(1000, null, false, startTs, endTs, null);
    assertTrue(
        entities.getData().stream()
            .noneMatch(
                tcrs -> tcrs.getTestCaseReference().getId().equals(testCases.get(0).getId())));
  }

  @Test
  void patch_TestCaseResultFailure(TestInfo test) throws HttpResponseException {
    TestCase testCaseEntity = createEntity(createRequest(getEntityName(test)), ADMIN_AUTH_HEADERS);
    CreateTestCaseResolutionStatus createTestCaseFailureStatus =
        new CreateTestCaseResolutionStatus()
            .withTestCaseReference(testCaseEntity.getFullyQualifiedName())
            .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.Ack)
            .withSeverity(Severity.Severity2)
            .withTestCaseResolutionStatusDetails(null);
    TestCaseResolutionStatus testCaseFailureStatus =
        createTestCaseFailureStatus(createTestCaseFailureStatus);
    String original = JsonUtils.pojoToJson(testCaseFailureStatus);
    String updated =
        JsonUtils.pojoToJson(
            testCaseFailureStatus
                .withUpdatedAt(System.currentTimeMillis())
                .withUpdatedBy(USER1_REF)
                .withSeverity(Severity.Severity1));
    JsonNode patch = TestUtils.getJsonPatch(original, updated);
    TestCaseResolutionStatus patched =
        patchTestCaseResultFailureStatus(testCaseFailureStatus.getId(), patch);
    TestCaseResolutionStatus stored = getTestCaseFailureStatus(testCaseFailureStatus.getId());

    // check our patch fields have been updated
    assertEquals(patched.getUpdatedAt(), stored.getUpdatedAt());
    assertEquals(patched.getUpdatedBy(), stored.getUpdatedBy());
    assertEquals(patched.getSeverity(), stored.getSeverity());
  }

  @Test
  void patch_TestCaseResultFailureUnauthorizedFields(TestInfo test) throws HttpResponseException {
    TestCase testCaseEntity = createEntity(createRequest(getEntityName(test)), ADMIN_AUTH_HEADERS);
    CreateTestCaseResolutionStatus createTestCaseFailureStatus =
        new CreateTestCaseResolutionStatus()
            .withTestCaseReference(testCaseEntity.getFullyQualifiedName())
            .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.Ack)
            .withTestCaseResolutionStatusDetails(null);
    TestCaseResolutionStatus testCaseFailureStatus =
        createTestCaseFailureStatus(createTestCaseFailureStatus);
    String original = JsonUtils.pojoToJson(testCaseFailureStatus);
    String updated =
        JsonUtils.pojoToJson(
            testCaseFailureStatus
                .withUpdatedAt(System.currentTimeMillis())
                .withUpdatedBy(USER1_REF)
                .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.Assigned));
    JsonNode patch = TestUtils.getJsonPatch(original, updated);

    assertResponse(
        () -> patchTestCaseResultFailureStatus(testCaseFailureStatus.getId(), patch),
        BAD_REQUEST,
        "Field testCaseResolutionStatusType is not allowed to be updated");
  }

  @Test
  void test_testCaseResolutionTaskResolveWorkflowThruFeed(TestInfo test)
      throws HttpResponseException, ParseException {
    Long startTs = System.currentTimeMillis();
    FeedResourceTest feedResourceTest = new FeedResourceTest();

    TestCase testCaseEntity = createEntity(createRequest(getEntityName(test)), ADMIN_AUTH_HEADERS);

    // Add failed test case, which will create a NEW incident
    postTestCaseResult(
        testCaseEntity.getFullyQualifiedName(),
        new CreateTestCaseResult()
            .withResult("result")
            .withTestCaseStatus(TestCaseStatus.Failed)
            .withTimestamp(TestUtils.dateToTimestamp("2024-01-01")),
        ADMIN_AUTH_HEADERS);

    // Now, we should be good to create an ASSIGNED status
    CreateTestCaseResolutionStatus createAssignedIncident =
        new CreateTestCaseResolutionStatus()
            .withTestCaseReference(testCaseEntity.getFullyQualifiedName())
            .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.Assigned)
            .withTestCaseResolutionStatusDetails(new Assigned().withAssignee(USER1_REF));
    TestCaseResolutionStatus assignedIncident = createTestCaseFailureStatus(createAssignedIncident);
    String jsonThread =
        Entity.getCollectionDAO()
            .feedDAO()
            .fetchThreadByTestCaseResolutionStatusId(assignedIncident.getStateId());
    Thread thread = JsonUtils.readValue(jsonThread, Thread.class);
    assertEquals(assignedIncident.getStateId(), thread.getTask().getTestCaseResolutionStatusId());
    assertEquals(TaskStatus.Open, thread.getTask().getStatus());

    // resolve the task. The old task should be closed and the latest test case resolution status
    // should be updated (resolved) with the same state ID

    ResolveTask resolveTask =
        new ResolveTask()
            .withTestCaseFQN(testCaseEntity.getFullyQualifiedName())
            .withTestCaseFailureReason(TestCaseFailureReasonType.FalsePositive)
            .withNewValue("False positive, test case was valid");
    feedResourceTest.resolveTask(thread.getTask().getId(), resolveTask, ADMIN_AUTH_HEADERS);
    jsonThread =
        Entity.getCollectionDAO()
            .feedDAO()
            .fetchThreadByTestCaseResolutionStatusId(assignedIncident.getStateId());
    thread = JsonUtils.readValue(jsonThread, Thread.class);
    // Confirm that the task is closed
    assertEquals(TaskStatus.Closed, thread.getTask().getStatus());

    // We'll confirm that we have created a new test case resolution status with the same state ID
    // and type Resolved
    ResultList<TestCaseResolutionStatus> mostRecentTestCaseResolutionStatus =
        getTestCaseFailureStatus(
            10,
            null,
            true,
            startTs,
            System.currentTimeMillis(),
            testCaseEntity.getFullyQualifiedName());
    assertEquals(1, mostRecentTestCaseResolutionStatus.getData().size());
    TestCaseResolutionStatus mostRecentTestCaseResolutionStatusData =
        mostRecentTestCaseResolutionStatus.getData().get(0);
    assertEquals(
        TestCaseResolutionStatusTypes.Resolved,
        mostRecentTestCaseResolutionStatusData.getTestCaseResolutionStatusType());
    assertEquals(
        assignedIncident.getStateId(), mostRecentTestCaseResolutionStatusData.getStateId());
    Resolved resolved =
        JsonUtils.convertValue(
            mostRecentTestCaseResolutionStatusData.getTestCaseResolutionStatusDetails(),
            Resolved.class);
    assertEquals(TestCaseFailureReasonType.FalsePositive, resolved.getTestCaseFailureReason());
    assertEquals("False positive, test case was valid", resolved.getTestCaseFailureComment());
  }

  @Test
  void test_testCaseResolutionTaskCloseWorkflowThruFeed(TestInfo test)
      throws HttpResponseException, ParseException {
    Long startTs = System.currentTimeMillis();
    FeedResourceTest feedResourceTest = new FeedResourceTest();

    TestCase testCaseEntity = createEntity(createRequest(getEntityName(test)), ADMIN_AUTH_HEADERS);

    // Add failed test case, which will create a NEW incident
    postTestCaseResult(
        testCaseEntity.getFullyQualifiedName(),
        new CreateTestCaseResult()
            .withResult("result")
            .withTestCaseStatus(TestCaseStatus.Failed)
            .withTimestamp(TestUtils.dateToTimestamp("2024-01-01")),
        ADMIN_AUTH_HEADERS);

    // Now, we should be good to create an ASSIGNED status
    CreateTestCaseResolutionStatus createAssignedIncident =
        new CreateTestCaseResolutionStatus()
            .withTestCaseReference(testCaseEntity.getFullyQualifiedName())
            .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.Assigned)
            .withTestCaseResolutionStatusDetails(new Assigned().withAssignee(USER1_REF));
    TestCaseResolutionStatus assignedIncident = createTestCaseFailureStatus(createAssignedIncident);

    // Assert that the task is open
    String jsonThread =
        Entity.getCollectionDAO()
            .feedDAO()
            .fetchThreadByTestCaseResolutionStatusId(assignedIncident.getStateId());
    Thread thread = JsonUtils.readValue(jsonThread, Thread.class);
    assertEquals(assignedIncident.getStateId(), thread.getTask().getTestCaseResolutionStatusId());
    assertEquals(TaskStatus.Open, thread.getTask().getStatus());

    // close the task. The old task should be closed and the latest test case resolution status
    // should be updated (resolved) with the same state ID.
    CloseTask closeTask =
        new CloseTask()
            .withComment(USER1.getFullyQualifiedName())
            .withTestCaseFQN(testCaseEntity.getFullyQualifiedName());
    feedResourceTest.closeTask(thread.getTask().getId(), closeTask, ADMIN_AUTH_HEADERS);
    jsonThread =
        Entity.getCollectionDAO()
            .feedDAO()
            .fetchThreadByTestCaseResolutionStatusId(assignedIncident.getStateId());
    thread = JsonUtils.readValue(jsonThread, Thread.class);
    assertEquals(TaskStatus.Closed, thread.getTask().getStatus());

    // We'll confirm that we have created a new test case resolution status with the same state ID
    // and type Assigned
    ResultList<TestCaseResolutionStatus> mostRecentTestCaseResolutionStatus =
        getTestCaseFailureStatus(
            10,
            null,
            true,
            startTs,
            System.currentTimeMillis(),
            testCaseEntity.getFullyQualifiedName());
    assertEquals(1, mostRecentTestCaseResolutionStatus.getData().size());
    TestCaseResolutionStatus mostRecentTestCaseResolutionStatusData =
        mostRecentTestCaseResolutionStatus.getData().get(0);
    assertEquals(
        TestCaseResolutionStatusTypes.Resolved,
        mostRecentTestCaseResolutionStatusData.getTestCaseResolutionStatusType());
    assertEquals(
        assignedIncident.getStateId(), mostRecentTestCaseResolutionStatusData.getStateId());
    mostRecentTestCaseResolutionStatusData.getMetrics().stream()
        .filter(m -> m.getName().equals("timeToResolution"))
        .forEach(m -> assertNotNull(m.getValue()));
  }

  @Test
  void test_testCaseResolutionTaskWorkflowThruAPI(TestInfo test)
      throws HttpResponseException, ParseException {
    TestCase testCaseEntity = createEntity(createRequest(getEntityName(test)), ADMIN_AUTH_HEADERS);

    // Add failed test case, which will create a NEW incident
    postTestCaseResult(
        testCaseEntity.getFullyQualifiedName(),
        new CreateTestCaseResult()
            .withResult("result")
            .withTestCaseStatus(TestCaseStatus.Failed)
            .withTimestamp(TestUtils.dateToTimestamp("2024-01-01")),
        ADMIN_AUTH_HEADERS);

    // Now, we should be good to create an ASSIGNED status
    CreateTestCaseResolutionStatus createAssignedIncident =
        new CreateTestCaseResolutionStatus()
            .withTestCaseReference(testCaseEntity.getFullyQualifiedName())
            .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.Assigned)
            .withTestCaseResolutionStatusDetails(new Assigned().withAssignee(USER1_REF));

    TestCaseResolutionStatus assignedIncident = createTestCaseFailureStatus(createAssignedIncident);

    // Confirm that the task is open
    String jsonThread =
        Entity.getCollectionDAO()
            .feedDAO()
            .fetchThreadByTestCaseResolutionStatusId(assignedIncident.getStateId());
    Thread thread = JsonUtils.readValue(jsonThread, Thread.class);
    assertEquals(TaskStatus.Open, thread.getTask().getStatus());
    assertEquals(assignedIncident.getStateId(), thread.getTask().getTestCaseResolutionStatusId());

    // Create a new test case resolution status with type Resolved
    // and confirm the task is closed
    CreateTestCaseResolutionStatus createTestCaseFailureStatusResolved =
        createAssignedIncident
            .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.Resolved)
            .withTestCaseResolutionStatusDetails(
                new Resolved()
                    .withTestCaseFailureComment("resolved")
                    .withTestCaseFailureReason(TestCaseFailureReasonType.MissingData)
                    .withResolvedBy(USER1_REF));
    createTestCaseFailureStatus(createTestCaseFailureStatusResolved);

    jsonThread = Entity.getCollectionDAO().feedDAO().findById(thread.getId());
    thread = JsonUtils.readValue(jsonThread, Thread.class);
    assertEquals(TaskStatus.Closed, thread.getTask().getStatus());
  }

  @Test
  void authorizedTestCaseResolutionFlow(TestInfo test)
      throws HttpResponseException, ParseException {
    TestCase testCaseEntity = createEntity(createRequest(getEntityName(test)), ADMIN_AUTH_HEADERS);
    // Add failed test case, which will create a NEW incident
    postTestCaseResult(
        testCaseEntity.getFullyQualifiedName(),
        new CreateTestCaseResult()
            .withResult("result")
            .withTestCaseStatus(TestCaseStatus.Failed)
            .withTimestamp(TestUtils.dateToTimestamp("2024-01-01")),
        ADMIN_AUTH_HEADERS);

    // Now, we should be good to create an ASSIGNED status
    CreateTestCaseResolutionStatus createAssignedIncident =
        new CreateTestCaseResolutionStatus()
            .withTestCaseReference(testCaseEntity.getFullyQualifiedName())
            .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.Assigned)
            .withTestCaseResolutionStatusDetails(new Assigned().withAssignee(USER1_REF));
    createTestCaseFailureStatus(createAssignedIncident);

    createTestCaseFailureStatus(
        createAssignedIncident.withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.Ack));
  }

  @Test
  void testInferSeverity() {
    IncidentSeverityClassifierInterface severityClassifier =
        IncidentSeverityClassifierInterface.getInstance();
    // TEST_TABLE1 has no tier information, hence severity should be null as the classifier won't be
    // able to infer
    Severity severity = severityClassifier.classifyIncidentSeverity(TEST_TABLE1);
    assertNull(severity);

    List<TagLabel> tags = new ArrayList<>();
    tags.add(new TagLabel().withTagFQN("Tier.Tier1").withName("Tier1"));
    TEST_TABLE1.setTags(tags);

    // With tier set to Tier1, the severity should be inferred
    severity = severityClassifier.classifyIncidentSeverity(TEST_TABLE1);
    assertNotNull(severity);
  }

  @Test
  void get_listTestCaseWithStatusAndType(TestInfo test) throws ParseException, IOException {

    int testCaseEntries = 15;

    List<TestCase> createdTestCase = new ArrayList<>();
    for (int i = 0; i < testCaseEntries; i++) {
      if (i % 2 == 0) {
        // Create column level test case
        createdTestCase.add(
            createEntity(
                createRequest(test, i + 1).withEntityLink(TABLE_LINK), ADMIN_AUTH_HEADERS));
        continue;
      }
      createdTestCase.add(createEntity(createRequest(test, i + 1), ADMIN_AUTH_HEADERS));
    }

    for (int i = 0; i < testCaseEntries; i++) {
      // Even number = Failed (8), Odd number = Success (7), 9 = Aborted (1)
      TestCaseStatus result;
      if (i % 2 == 0) {
        result = TestCaseStatus.Failed;
      } else if (i == 9) {
        result = TestCaseStatus.Aborted;
      } else {
        result = TestCaseStatus.Success;
      }
      CreateTestCaseResult createTestCaseResult =
          new CreateTestCaseResult()
              .withResult("result")
              .withTestCaseStatus(result)
              .withTimestamp(TestUtils.dateToTimestamp("2024-01-01"));
      postTestCaseResult(
          createdTestCase.get(i).getFullyQualifiedName(), createTestCaseResult, ADMIN_AUTH_HEADERS);
    }

    String testSuiteId = createdTestCase.get(0).getTestSuite().getId().toString();

    Map<String, Object> queryParams = new HashMap<>();
    queryParams.put("limit", 100);
    queryParams.put("testSuiteId", testSuiteId);
    queryParams.put("fields", "testSuite");
    // Assert we get all 15 test cases
    ResultList<TestCase> testCases = getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    assertTrue(
        testCases.getData().stream()
            .allMatch(t -> t.getTestSuite().getId().toString().equals(testSuiteId)));

    // Assert we get 8 failed test cases
    queryParams.put("testCaseStatus", TestCaseStatus.Failed);
    testCases = getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    assertTrue(
        testCases.getData().stream()
            .allMatch(t -> t.getTestCaseStatus().equals(TestCaseStatus.Failed)));

    // Assert we get 7 success test cases
    queryParams.put("testCaseStatus", TestCaseStatus.Success);
    testCases = getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    assertTrue(
        testCases.getData().stream()
            .allMatch(t -> t.getTestCaseStatus().equals(TestCaseStatus.Success)));

    // Assert we get 1 aborted test cases
    queryParams.put("testCaseStatus", TestCaseStatus.Aborted);
    testCases = getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    assertTrue(
        testCases.getData().stream()
            .allMatch(t -> t.getTestCaseStatus().equals(TestCaseStatus.Aborted)));

    queryParams.remove("testCaseStatus");

    // Assert we get 7 column level test cases
    queryParams.put("testCaseType", "column");
    queryParams.put("fields", "testDefinition");
    testCases = getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    assertTrue(
        testCases.getData().stream()
            .allMatch(
                t -> {
                  TestDefinition testDefinition =
                      Entity.getEntity(t.getTestDefinition(), "", Include.ALL);
                  return testDefinition.getEntityType().equals(TestDefinitionEntityType.COLUMN);
                }));

    // Assert we get 8 table level test cases
    queryParams.put("testCaseType", "table");
    queryParams.put("fields", "testDefinition");
    testCases = getTestCases(queryParams, ADMIN_AUTH_HEADERS);
    testCases.getData().stream()
        .filter(
            t -> {
              TestDefinition testDefinition =
                  Entity.getEntity(t.getTestDefinition(), "", Include.ALL);
              return testDefinition.getEntityType().equals(TestDefinitionEntityType.TABLE);
            });
    assertTrue(
        testCases.getData().stream()
            .allMatch(
                t -> {
                  MessageParser.EntityLink entityLink =
                      MessageParser.EntityLink.parse(t.getEntityLink());
                  return entityLink.getFieldName() == null; // should be empty for table test cases
                }));
  }

  @Test
  void wrongMinMaxTestParameter(TestInfo test) throws HttpResponseException {
    CreateTestCase validTestCase = createRequest(test);
    validTestCase
        .withTestDefinition(TEST_DEFINITION4.getFullyQualifiedName())
        .withParameterValues(
            List.of(new TestCaseParameterValue().withName("minLength").withValue("10")));
    createEntity(validTestCase, ADMIN_AUTH_HEADERS);

    validTestCase = createRequest(test, 1);
    validTestCase
        .withTestDefinition(TEST_DEFINITION4.getFullyQualifiedName())
        .withParameterValues(List.of(new TestCaseParameterValue().withName("max").withValue("10")));
    createEntity(validTestCase, ADMIN_AUTH_HEADERS);

    CreateTestCase invalidTestCase = createRequest(test, 2);
    invalidTestCase
        .withTestDefinition(TEST_DEFINITION5.getFullyQualifiedName())
        .withParameterValues(
            List.of(
                new TestCaseParameterValue().withName("minLength").withValue("10"),
                new TestCaseParameterValue().withName("maxLength").withValue("5")));

    assertResponseContains(
        () -> createEntity(invalidTestCase, ADMIN_AUTH_HEADERS), BAD_REQUEST, "Value");

    CreateTestCase invalidTestCaseMixedTypes = createRequest(test, 3);
    invalidTestCaseMixedTypes
        .withTestDefinition(TEST_DEFINITION5.getFullyQualifiedName())
        .withParameterValues(
            List.of(
                new TestCaseParameterValue().withName("minLength").withValue("10.6"),
                new TestCaseParameterValue().withName("maxLength").withValue("5")));

    assertResponseContains(
        () -> createEntity(invalidTestCaseMixedTypes, ADMIN_AUTH_HEADERS), BAD_REQUEST, "Value");
  }

  @Test
  void test_testCaseEsDocCleanUp() {
    TestCase testCase =
        new TestCase()
            .withId(UUID.randomUUID())
            .withChangeDescription(new ChangeDescription())
            .withTestSuites(
                List.of(
                    new TestSuite()
                        .withId(UUID.randomUUID())
                        .withChangeDescription(new ChangeDescription()),
                    new TestSuite()
                        .withId(UUID.randomUUID())
                        .withChangeDescription(new ChangeDescription())));

    Map<String, Object> doc = JsonUtils.convertValue(testCase, Map.class);

    TestCaseIndex testCaseIndex = new TestCaseIndex(testCase);
    testCaseIndex.removeNonIndexableFields(doc);
    assertNull(doc.get("changeDescription"));
    List<Map<String, Object>> testSuites = (List<Map<String, Object>>) doc.get("testSuites");
    assertNull(testSuites.get(0).get("changeDescription"));

    // Remove changeDescription logic handles null testSuites
    testCase.setTestSuites(null);
    doc = JsonUtils.convertValue(testCase, Map.class);
    testCaseIndex = new TestCaseIndex(testCase);
    testCaseIndex.removeNonIndexableFields(doc);
  }

  @Test
  void put_and_delete_failedRowSample_200(TestInfo test) throws IOException, ParseException {
    CreateTestCase create =
        createRequest(test)
            .withEntityLink(TABLE_LINK)
            .withTestDefinition(TEST_DEFINITION4.getFullyQualifiedName())
            .withParameterValues(
                List.of(new TestCaseParameterValue().withValue("100").withName("max")));
    TestCase testCase = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    List<String> columns = Arrays.asList(C1, C2, C3);

    // Add 3 rows of sample data for 3 columns
    List<List<Object>> rows =
        Arrays.asList(
            Arrays.asList("c1Value1", 1, true),
            Arrays.asList("c1Value2", null, false),
            Arrays.asList("c1Value3", 3, true));

    // Cannot set failed sample for a non-failing test case
    assertResponse(
        () -> putFailedRowsSample(testCase, columns, rows, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Failed rows can only be added to a failed test case.");

    // Add failed test case, which will create a NEW incident
    postTestCaseResult(
        testCase.getFullyQualifiedName(),
        new CreateTestCaseResult()
            .withResult("result")
            .withTestCaseStatus(TestCaseStatus.Failed)
            .withTimestamp(TestUtils.dateToTimestamp("2024-01-01")),
        ADMIN_AUTH_HEADERS);
    // Sample data can be put as an ADMIN
    putFailedRowsSample(testCase, columns, rows, ADMIN_AUTH_HEADERS);

    // Sample data can be put as owner
    rows.get(0).set(1, 2); // Change value 1 to 2
    putFailedRowsSample(testCase, columns, rows, authHeaders(USER1.getName()));

    // Sample data can't be put as non-owner, non-admin
    assertResponse(
        () -> putFailedRowsSample(testCase, columns, rows, authHeaders(USER2.getName())),
        FORBIDDEN,
        permissionNotAllowed(USER2.getName(), List.of(EDIT_TESTS)));

    deleteFailedRowsSample(testCase);

    assertResponse(
        () -> getSampleData(testCase.getId(), ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        FAILED_ROWS_SAMPLE_EXTENSION + " instance for " + testCase.getId() + " not found");
  }

  @Test
  void put_failedRowSample_without_validation_200(TestInfo test)
      throws IOException, ParseException {
    CreateTestCase create =
        createRequest(test)
            .withEntityLink(TABLE_LINK)
            .withTestDefinition(TEST_DEFINITION4.getFullyQualifiedName())
            .withParameterValues(
                List.of(new TestCaseParameterValue().withValue("100").withName("max")));
    TestCase testCase = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    List<String> columns = Arrays.asList("NOT_A_COLUMN", C1, C2, C3);

    // Add 3 rows of sample data for 3 columns
    List<List<Object>> rows =
        Arrays.asList(
            Arrays.asList("to be", "c1Value1", 1, true),
            Arrays.asList("or not", "c1Value2", null, false),
            Arrays.asList("to be", "c1Value3", 3, true));

    // Add failed test case, which will create a NEW incident
    postTestCaseResult(
        testCase.getFullyQualifiedName(),
        new CreateTestCaseResult()
            .withResult("result")
            .withTestCaseStatus(TestCaseStatus.Failed)
            .withTimestamp(TestUtils.dateToTimestamp("2024-01-01")),
        ADMIN_AUTH_HEADERS);

    // fail to put sample row with invalid column
    assertResponse(
        () -> putFailedRowsSample(testCase, columns, rows, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Invalid column name NOT_A_COLUMN");

    // successfully put sample row with invalid column when set query param validate=false
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("validate", "false");
    putFailedRowsSample(testCase, columns, rows, ADMIN_AUTH_HEADERS, queryParams);
  }

  @Test
  void resolved_test_case_deletes_sample_data(TestInfo test) throws IOException, ParseException {
    CreateTestCase create =
        createRequest(test)
            .withEntityLink(TABLE_LINK)
            .withTestDefinition(TEST_DEFINITION4.getFullyQualifiedName())
            .withParameterValues(
                List.of(new TestCaseParameterValue().withValue("100").withName("max")));
    TestCase testCase = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    List<String> columns = Arrays.asList(C1, C2, C3);

    // Add 3 rows of sample data for 3 columns
    List<List<Object>> rows =
        Arrays.asList(
            Arrays.asList("c1Value1", 1, true),
            Arrays.asList("c1Value2", null, false),
            Arrays.asList("c1Value3", 3, true));

    postTestCaseResult(
        testCase.getFullyQualifiedName(),
        new CreateTestCaseResult()
            .withResult("result")
            .withTestCaseStatus(TestCaseStatus.Failed)
            .withTimestamp(TestUtils.dateToTimestamp("2024-01-01")),
        ADMIN_AUTH_HEADERS);

    putFailedRowsSample(testCase, columns, rows, ADMIN_AUTH_HEADERS);

    // resolving test case deletes the sample data
    CreateTestCaseResult createTestCaseResult =
        new CreateTestCaseResult()
            .withResult("tested")
            .withTestCaseStatus(TestCaseStatus.Success)
            .withTimestamp(TestUtils.dateToTimestamp("2021-09-09"));
    postTestCaseResult(testCase.getFullyQualifiedName(), createTestCaseResult, ADMIN_AUTH_HEADERS);
    assertResponse(
        () -> getSampleData(testCase.getId(), ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        FAILED_ROWS_SAMPLE_EXTENSION + " instance for " + testCase.getId() + " not found");
  }

  @Test
  void test_sensitivePIISampleData(TestInfo test) throws IOException, ParseException {
    // Create table with owner and a column tagged with PII.Sensitive
    TableResourceTest tableResourceTest = new TableResourceTest();
    CreateTable tableReq = getSensitiveTableReq(test, tableResourceTest);
    Table sensitiveTable = tableResourceTest.createAndCheckEntity(tableReq, ADMIN_AUTH_HEADERS);
    String sensitiveColumnLink =
        String.format("<#E::table::%s::columns::%s>", sensitiveTable.getFullyQualifiedName(), C1);
    CreateTestCase create =
        createRequest(test)
            .withEntityLink(sensitiveColumnLink)
            .withTestDefinition(TEST_DEFINITION3.getFullyQualifiedName())
            .withParameterValues(
                List.of(
                    new TestCaseParameterValue().withValue("100").withName("missingCountValue")));
    TestCase testCase = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    postTestCaseResult(
        testCase.getFullyQualifiedName(),
        new CreateTestCaseResult()
            .withResult("result")
            .withTestCaseStatus(TestCaseStatus.Failed)
            .withTimestamp(TestUtils.dateToTimestamp("2024-01-01")),
        ADMIN_AUTH_HEADERS);
    List<String> columns = List.of(C1);
    // Add 3 rows of sample data
    List<List<Object>> rows =
        Arrays.asList(List.of("c1Value1"), List.of("c1Value2"), List.of("c1Value3"));
    // add sample data
    putFailedRowsSample(testCase, columns, rows, ADMIN_AUTH_HEADERS);
    // assert values are not masked for the table owner
    TableData data = getSampleData(testCase.getId(), authHeaders(USER1.getName()));
    assertFalse(
        data.getRows().stream()
            .flatMap(List::stream)
            .map(r -> r == null ? "" : r)
            .map(Object::toString)
            .anyMatch(MASKED_VALUE::equals));
    // assert values are masked when is not the table owner
    data = getSampleData(testCase.getId(), authHeaders(USER2.getName()));
    assertEquals(
        3,
        data.getRows().stream()
            .flatMap(List::stream)
            .map(r -> r == null ? "" : r)
            .map(Object::toString)
            .filter(MASKED_VALUE::equals)
            .count());
  }

  @Test
  void test_addInspectionQuery(TestInfo test) throws IOException {
    CreateTestCase create =
        createRequest(test)
            .withEntityLink(TABLE_LINK)
            .withTestDefinition(TEST_DEFINITION4.getFullyQualifiedName())
            .withParameterValues(
                List.of(new TestCaseParameterValue().withValue("100").withName("max")));
    TestCase testCase = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    String inspectionQuery = "SELECT * FROM test_table WHERE column1 = 'value1'";
    putInspectionQuery(testCase, inspectionQuery);
    TestCase updated = getTestCase(testCase.getFullyQualifiedName(), ADMIN_AUTH_HEADERS);
    assertEquals(updated.getInspectionQuery(), inspectionQuery);
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  protected void post_entityCreateWithInvalidName_400() {
    // Create an entity with mandatory name field null
    final CreateTestCase request = createRequest(null, "description", "displayName", null);
    assertResponseContains(
        () -> createEntity(request, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param name must not be null]");

    // Create an entity with mandatory name field empty
    final CreateTestCase request1 = createRequest("", "description", "displayName", null);
    assertResponseContains(
        () -> createEntity(request1, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        TestUtils.getEntityNameLengthError(entityClass));

    // Any entity name that has EntityLink separator must fail
    final CreateTestCase request3 =
        createRequest("invalid::Name", "description", "displayName", null);
    assertResponseContains(
        () -> createEntity(request3, ADMIN_AUTH_HEADERS), BAD_REQUEST, "name must match");
  }

  @Test
  void createUpdate_DynamicAssertionTests(TestInfo testInfo) throws IOException {
    CreateTestCase create = createRequest(testInfo).withUseDynamicAssertion(true);
    TestCase testCase = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    testCase = getTestCase(testCase.getFullyQualifiedName(), ADMIN_AUTH_HEADERS);
    assertTrue(testCase.getUseDynamicAssertion());
    CreateTestCase update = create.withUseDynamicAssertion(false);
    updateEntity(update, OK, ADMIN_AUTH_HEADERS);
    testCase = getTestCase(testCase.getFullyQualifiedName(), ADMIN_AUTH_HEADERS);
    assertFalse(testCase.getUseDynamicAssertion());
  }

  // BEGINNING OF TEST CASE RESULTS TESTS

  @Test
  void put_testCaseResults_200(TestInfo test) throws IOException, ParseException {
    List<TestCaseResult> testCaseResultsList = new ArrayList<>();
    CreateTestCase create = createRequest(test);
    create
        .withEntityLink(TABLE_COLUMN_LINK)
        .withTestDefinition(TEST_DEFINITION3.getFullyQualifiedName())
        .withParameterValues(
            List.of(new TestCaseParameterValue().withValue("100").withName("missingCountValue")));
    TestCase testCase = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    CreateTestCaseResult createTestCaseResult =
        new CreateTestCaseResult()
            .withResult("tested")
            .withTestCaseStatus(TestCaseStatus.Success)
            .withTimestamp(TestUtils.dateToTimestamp("2021-09-09"));
    testCaseResultsList.add(
        postTestCaseResult(
            testCase.getFullyQualifiedName(), createTestCaseResult, ADMIN_AUTH_HEADERS));

    ResultList<TestCaseResult> testCaseResults =
        getTestCaseResults(
            testCase.getFullyQualifiedName(),
            TestUtils.dateToTimestamp("2021-09-09"),
            TestUtils.dateToTimestamp("2021-09-10"),
            ADMIN_AUTH_HEADERS);
    verifyTestCaseResults(testCaseResults, testCaseResultsList, 1);

    // Add new data for TableCaseResult
    createTestCaseResult =
        new CreateTestCaseResult()
            .withResult("tested")
            .withTestCaseStatus(TestCaseStatus.Failed)
            .withTimestamp(TestUtils.dateToTimestamp("2021-09-10"));
    testCaseResultsList.add(
        postTestCaseResult(
            testCase.getFullyQualifiedName(), createTestCaseResult, ADMIN_AUTH_HEADERS));

    testCaseResults =
        getTestCaseResults(
            testCase.getFullyQualifiedName(),
            TestUtils.dateToTimestamp("2021-09-09"),
            TestUtils.dateToTimestamp("2021-09-10"),
            ADMIN_AUTH_HEADERS);
    verifyTestCaseResults(testCaseResults, testCaseResultsList, 2);

    testCase = getEntity(testCase.getId(), "testCaseResult", ADMIN_AUTH_HEADERS);
    // first result should be the latest date
    testCaseResults =
        getTestCaseResults(
            testCase.getFullyQualifiedName(),
            TestUtils.dateToTimestamp("2021-09-09"),
            TestUtils.dateToTimestamp("2021-09-10"),
            ADMIN_AUTH_HEADERS);
    verifyTestCaseResults(testCaseResults, testCaseResultsList, 2);

    String dateStr = "2021-09-";
    for (int i = 11; i <= 20; i++) {
      createTestCaseResult =
          new CreateTestCaseResult()
              .withResult("result")
              .withTestCaseStatus(TestCaseStatus.Success)
              .withTimestamp(TestUtils.dateToTimestamp(dateStr + i));
      testCaseResultsList.add(
          postTestCaseResult(
              testCase.getFullyQualifiedName(), createTestCaseResult, ADMIN_AUTH_HEADERS));
    }
    testCaseResults =
        getTestCaseResults(
            testCase.getFullyQualifiedName(),
            TestUtils.dateToTimestamp("2021-09-09"),
            TestUtils.dateToTimestamp("2021-09-20"),
            ADMIN_AUTH_HEADERS);
    verifyTestCaseResults(testCaseResults, testCaseResultsList, 12);

    // create another table and add test results
    TestCase testCase1 = createAndCheckEntity(createRequest(test, 1), ADMIN_AUTH_HEADERS);
    List<TestCaseResult> testCase1ResultsList = new ArrayList<>();
    dateStr = "2021-10-";
    for (int i = 11; i <= 15; i++) {
      createTestCaseResult =
          new CreateTestCaseResult()
              .withResult("result")
              .withTestCaseStatus(TestCaseStatus.Failed)
              .withTimestamp(TestUtils.dateToTimestamp(dateStr + i));
      testCase1ResultsList.add(
          postTestCaseResult(
              testCase1.getFullyQualifiedName(), createTestCaseResult, ADMIN_AUTH_HEADERS));
    }
    testCaseResults =
        getTestCaseResults(
            testCase1.getFullyQualifiedName(),
            TestUtils.dateToTimestamp("2021-10-11"),
            TestUtils.dateToTimestamp("2021-10-15"),
            ADMIN_AUTH_HEADERS);
    verifyTestCaseResults(testCaseResults, testCase1ResultsList, 5);
    deleteTestCaseResult(
        testCase1.getFullyQualifiedName(),
        TestUtils.dateToTimestamp("2021-10-11"),
        ADMIN_AUTH_HEADERS);
    testCase1ResultsList.remove(0);
    testCaseResults =
        getTestCaseResults(
            testCase1.getFullyQualifiedName(),
            TestUtils.dateToTimestamp("2021-10-11"),
            TestUtils.dateToTimestamp("2021-10-15"),
            ADMIN_AUTH_HEADERS);
    verifyTestCaseResults(testCaseResults, testCase1ResultsList, 4);

    validateListTestCaseResultsFromSearchWithPagination(
        new HashMap<>(),
        testCase1ResultsList.size() + testCaseResultsList.size(),
        "/testCaseResults/search/list");

    if (supportsSearchIndex) {
      getAndValidateTestSummary(null);
    }

    // Test that we can get the test summary for a logical test suite and that
    // adding a logical test suite does not change the total number of tests
    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();
    CreateTestSuite createLogicalTestSuite = testSuiteResourceTest.createRequest(test);
    TestSuite logicalTestSuite =
        testSuiteResourceTest.createEntity(createLogicalTestSuite, ADMIN_AUTH_HEADERS);
    List<UUID> testCaseIds = new ArrayList<>();
    testCaseIds.add(testCase1.getId());
    testSuiteResourceTest.addTestCasesToLogicalTestSuite(logicalTestSuite, testCaseIds);

    if (supportsSearchIndex) {
      getAndValidateTestSummary(logicalTestSuite.getId().toString());
      getAndValidateTestSummary(null);
    }

    // add a new test case to the logical test suite to validate if the
    // summary is updated correctly
    testCaseIds.clear();
    testCaseIds.add(testCase.getId());
    testSuiteResourceTest.addTestCasesToLogicalTestSuite(logicalTestSuite, testCaseIds);
    if (supportsSearchIndex) {
      getAndValidateTestSummary(logicalTestSuite.getId().toString());
      getAndValidateTestSummary(null);
    }

    // remove test case from logical test suite and validate
    // the summary is updated as expected
    deleteLogicalTestCase(logicalTestSuite, testCase.getId());

    if (supportsSearchIndex) {
      getAndValidateTestSummary(logicalTestSuite.getId().toString());
      getAndValidateTestSummary(null);
    }
  }

  @Test
  void test_testCaseResultState(TestInfo test) throws IOException, ParseException {
    // Create table for our test
    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();
    TestSuite testSuite = createExecutableTestSuite(test);

    // create testCase
    CreateTestCase createTestCase =
        new CreateTestCase()
            .withName(test.getDisplayName())
            .withDescription(test.getDisplayName())
            .withEntityLink(
                String.format(
                    "<#E::table::%s>", testSuite.getBasicEntityReference().getFullyQualifiedName()))
            .withTestDefinition(TEST_DEFINITION4.getFullyQualifiedName());
    TestCase testCase = createAndCheckEntity(createTestCase, ADMIN_AUTH_HEADERS);
    UUID testSuiteId = testCase.getTestSuite().getId();

    String dateStr = "2023-08-";
    for (int i = 11; i <= 15; i++) {
      CreateTestCaseResult createTestCaseResult =
          new CreateTestCaseResult()
              .withResult("result")
              .withTestCaseStatus(TestCaseStatus.Failed)
              .withTimestamp(TestUtils.dateToTimestamp(dateStr + i));
      postTestCaseResult(
          testCase.getFullyQualifiedName(), createTestCaseResult, ADMIN_AUTH_HEADERS);
    }

    // check that result state is the latest
    TestCase storedTestCase = getEntity(testCase.getId(), "testCaseResult", ADMIN_AUTH_HEADERS);
    TestSuite storedTestSuite =
        testSuiteResourceTest.getEntity(testSuiteId, "*", ADMIN_AUTH_HEADERS);
    ResultSummary testSuiteResultSummary =
        storedTestSuite.getTestCaseResultSummary().stream()
            .filter(t -> t.getTestCaseName().equals(testCase.getFullyQualifiedName()))
            .findFirst()
            .orElse(null);
    assertEquals(
        TestUtils.dateToTimestamp("2023-08-15"), storedTestCase.getTestCaseResult().getTimestamp());
    assertEquals(1, storedTestSuite.getSummary().getTotal());
    if (testSuiteResultSummary != null)
      assertEquals(TestUtils.dateToTimestamp("2023-08-15"), testSuiteResultSummary.getTimestamp());

    // delete latest and check that result is the  new latest (i.e. the 14th)
    deleteTestCaseResult(
        testCase.getFullyQualifiedName(),
        TestUtils.dateToTimestamp("2023-08-15"),
        ADMIN_AUTH_HEADERS);
    storedTestCase = getEntity(testCase.getId(), "testCaseResult", ADMIN_AUTH_HEADERS);
    storedTestSuite = testSuiteResourceTest.getEntity(testSuiteId, "*", ADMIN_AUTH_HEADERS);
    testSuiteResultSummary =
        storedTestSuite.getTestCaseResultSummary().stream()
            .filter(t -> t.getTestCaseName().equals(testCase.getFullyQualifiedName()))
            .findFirst()
            .orElse(null);
    assertEquals(
        TestUtils.dateToTimestamp("2023-08-14"), storedTestCase.getTestCaseResult().getTimestamp());
    assertEquals(1, storedTestSuite.getSummary().getTotal());
    if (testSuiteResultSummary != null)
      assertEquals(TestUtils.dateToTimestamp("2023-08-14"), testSuiteResultSummary.getTimestamp());

    // delete the 13h and check that result is still the 14th
    deleteTestCaseResult(
        testCase.getFullyQualifiedName(),
        TestUtils.dateToTimestamp("2023-08-13"),
        ADMIN_AUTH_HEADERS);
    storedTestSuite = testSuiteResourceTest.getEntity(testSuiteId, "*", ADMIN_AUTH_HEADERS);
    testSuiteResultSummary =
        storedTestSuite.getTestCaseResultSummary().stream()
            .filter(t -> t.getTestCaseName().equals(testCase.getFullyQualifiedName()))
            .findFirst()
            .orElse(null);
    storedTestCase = getEntity(testCase.getId(), "testCaseResult", ADMIN_AUTH_HEADERS);
    assertEquals(
        TestUtils.dateToTimestamp("2023-08-14"), storedTestCase.getTestCaseResult().getTimestamp());
    assertEquals(1, storedTestSuite.getSummary().getTotal());
    if (testSuiteResultSummary != null)
      assertEquals(TestUtils.dateToTimestamp("2023-08-14"), testSuiteResultSummary.getTimestamp());

    // Patch the test case result adding the resolved status
    TestCaseResult testCaseResult = storedTestCase.getTestCaseResult();
    String original = JsonUtils.pojoToJson(testCaseResult);
    JsonNode patch = TestUtils.getJsonPatch(original, JsonUtils.pojoToJson(testCaseResult));
    patchTestCaseResult(testCase.getFullyQualifiedName(), dateToTimestamp("2023-08-14"), patch);

    // add a new test case result for the 16th and check the state is correctly updated
    CreateTestCaseResult createTestCaseResult =
        new CreateTestCaseResult()
            .withResult("result")
            .withTestCaseStatus(TestCaseStatus.Failed)
            .withTimestamp(TestUtils.dateToTimestamp(dateStr + 16));
    postTestCaseResult(testCase.getFullyQualifiedName(), createTestCaseResult, ADMIN_AUTH_HEADERS);
    storedTestCase = getEntity(testCase.getId(), "testCaseResult", ADMIN_AUTH_HEADERS);
    storedTestSuite = testSuiteResourceTest.getEntity(testSuiteId, "*", ADMIN_AUTH_HEADERS);
    testSuiteResultSummary =
        storedTestSuite.getTestCaseResultSummary().stream()
            .filter(t -> t.getTestCaseName().equals(testCase.getFullyQualifiedName()))
            .findFirst()
            .orElse(null);
    assertEquals(
        TestUtils.dateToTimestamp("2023-08-16"), storedTestCase.getTestCaseResult().getTimestamp());
    assertEquals(1, storedTestSuite.getSummary().getTotal());
    if (testSuiteResultSummary != null)
      assertEquals(TestUtils.dateToTimestamp("2023-08-16"), testSuiteResultSummary.getTimestamp());

    // Add a new test case
    CreateTestCase create = createRequest(test, 3);
    create.withEntityLink(testCase.getEntityLink());
    TestCase testCase1 = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    for (int i = 19; i <= 20; i++) {
      postTestCaseResult(
          testCase1.getFullyQualifiedName(),
          new CreateTestCaseResult()
              .withResult("result")
              .withTestCaseStatus(TestCaseStatus.Failed)
              .withTimestamp(TestUtils.dateToTimestamp(dateStr + i)),
          ADMIN_AUTH_HEADERS);
    }

    storedTestSuite = testSuiteResourceTest.getEntity(testSuiteId, "*", ADMIN_AUTH_HEADERS);
    assertEquals(2, storedTestSuite.getTestCaseResultSummary().size());

    deleteEntity(testCase1.getId(), true, true, ADMIN_AUTH_HEADERS);
    storedTestSuite = testSuiteResourceTest.getEntity(testSuiteId, "*", ADMIN_AUTH_HEADERS);
    assertEquals(1, storedTestSuite.getTestCaseResultSummary().size());
  }

  @Test
  void get_testCaseResultWithIncidentId(TestInfo test)
      throws HttpResponseException, ParseException {

    // We create a test case with a failure
    TestCase testCaseEntity = createEntity(createRequest(getEntityName(test)), ADMIN_AUTH_HEADERS);
    postTestCaseResult(
        testCaseEntity.getFullyQualifiedName(),
        new CreateTestCaseResult()
            .withResult("result")
            .withTestCaseStatus(TestCaseStatus.Failed)
            .withTimestamp(TestUtils.dateToTimestamp("2024-01-01")),
        ADMIN_AUTH_HEADERS);

    // We can get it via API with a list of ongoing incidents
    TestCase result = getTestCase(testCaseEntity.getFullyQualifiedName(), ADMIN_AUTH_HEADERS);
    UUID incidentId = result.getIncidentId();
    assertNotNull(result.getIncidentId());

    // Resolving the status
    CreateTestCaseResolutionStatus createResolvedStatus =
        new CreateTestCaseResolutionStatus()
            .withTestCaseReference(testCaseEntity.getFullyQualifiedName())
            .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.Resolved)
            .withTestCaseResolutionStatusDetails(
                new Resolved()
                    .withTestCaseFailureComment("resolved")
                    .withTestCaseFailureReason(TestCaseFailureReasonType.MissingData)
                    .withResolvedBy(USER1_REF));
    createTestCaseFailureStatus(createResolvedStatus);

    result = getTestCase(testCaseEntity.getFullyQualifiedName(), ADMIN_AUTH_HEADERS);
    assertNotNull(result.getIncidentId());
    assertEquals(incidentId, result.getIncidentId());

    // Add a new failed result, which will create a NEW incident and start a new stateId
    postTestCaseResult(
        testCaseEntity.getFullyQualifiedName(),
        new CreateTestCaseResult()
            .withResult("result")
            .withTestCaseStatus(TestCaseStatus.Failed)
            .withTimestamp(TestUtils.dateToTimestamp("2024-01-02")),
        ADMIN_AUTH_HEADERS);

    result = getTestCase(testCaseEntity.getFullyQualifiedName(), ADMIN_AUTH_HEADERS);
    UUID newIncidentId = result.getIncidentId();

    assertNotNull(result.getIncidentId());
    assertNotEquals(incidentId, result.getIncidentId());

    // Add a new testCase Result with status Success. This should clear the incidentId
    // from the testCase and the testCaseResult should not have an incidentId.
    postTestCaseResult(
        testCaseEntity.getFullyQualifiedName(),
        new CreateTestCaseResult()
            .withResult("result")
            .withTestCaseStatus(TestCaseStatus.Success)
            .withTimestamp(TestUtils.dateToTimestamp("2024-01-03")),
        ADMIN_AUTH_HEADERS);

    result = getTestCase(testCaseEntity.getFullyQualifiedName(), ADMIN_AUTH_HEADERS);
    List<TestCaseResult> testCaseResults =
        getTestCaseResults(
                testCaseEntity.getFullyQualifiedName(),
                TestUtils.dateToTimestamp("2024-01-03"),
                TestUtils.dateToTimestamp("2024-01-03"),
                ADMIN_AUTH_HEADERS)
            .getData();
    assertNull(testCaseResults.get(0).getIncidentId());
    assertNull(result.getIncidentId());

    // Add a new testCase Result with status Failure at an older date.
    // The incidentId should be the one from "2024-01-02" but the testCase incidentId should be null
    // as it should reflect the latest testCaseResult
    postTestCaseResult(
        testCaseEntity.getFullyQualifiedName(),
        new CreateTestCaseResult()
            .withResult("result")
            .withTestCaseStatus(TestCaseStatus.Failed)
            .withTimestamp(TestUtils.dateToTimestamp("2023-12-31")),
        ADMIN_AUTH_HEADERS);
    result = getTestCase(testCaseEntity.getFullyQualifiedName(), ADMIN_AUTH_HEADERS);
    testCaseResults =
        getTestCaseResults(
                testCaseEntity.getFullyQualifiedName(),
                TestUtils.dateToTimestamp("2023-12-31"),
                TestUtils.dateToTimestamp("2023-12-31"),
                ADMIN_AUTH_HEADERS)
            .getData();
    assertEquals(newIncidentId, testCaseResults.get(0).getIncidentId());
    assertNull(result.getIncidentId());
  }

  @Test
  void patch_testCaseResults_noChange(TestInfo test) throws IOException, ParseException {
    CreateTestCase create =
        createRequest(test)
            .withEntityLink(TABLE_LINK_2)
            .withTestDefinition(TEST_DEFINITION4.getFullyQualifiedName())
            .withParameterValues(
                List.of(new TestCaseParameterValue().withValue("100").withName("max")));
    TestCase testCase = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    CreateTestCaseResult createTestCaseResult =
        new CreateTestCaseResult()
            .withResult("tested")
            .withTestCaseStatus(TestCaseStatus.Success)
            .withTimestamp(TestUtils.dateToTimestamp("2021-09-09"));
    TestCaseResult testCaseResult =
        postTestCaseResult(
            testCase.getFullyQualifiedName(), createTestCaseResult, ADMIN_AUTH_HEADERS);

    String original = JsonUtils.pojoToJson(testCaseResult);
    testCaseResult.setTestCaseStatus(TestCaseStatus.Failed);
    JsonNode patch = TestUtils.getJsonPatch(original, JsonUtils.pojoToJson(testCaseResult));

    patchTestCaseResult(testCase.getFullyQualifiedName(), dateToTimestamp("2021-09-09"), patch);

    ResultList<TestCaseResult> testCaseResultResultListUpdated =
        getTestCaseResults(
            testCase.getFullyQualifiedName(),
            TestUtils.dateToTimestamp("2021-09-09"),
            TestUtils.dateToTimestamp("2021-09-09"),
            ADMIN_AUTH_HEADERS);

    assertEquals(
        TestCaseStatus.Failed,
        testCaseResultResultListUpdated.getData().get(0).getTestCaseStatus());
  }

  @Test
  void test_resultSummaryCascadeToAllSuites(TestInfo test) throws IOException, ParseException {
    TestCase testCase = createAndCheckEntity(createRequest(test, 1), ADMIN_AUTH_HEADERS);
    TestCase testCase1 = createAndCheckEntity(createRequest(test, 2), ADMIN_AUTH_HEADERS);

    CreateTestCaseResult createTestCaseResult;

    String dateStr = "2021-10-";
    for (int i = 11; i <= 15; i++) {
      createTestCaseResult =
          new CreateTestCaseResult()
              .withResult("result")
              .withTestCaseStatus(TestCaseStatus.Failed)
              .withTimestamp(TestUtils.dateToTimestamp(dateStr + i));
      postTestCaseResult(
          testCase.getFullyQualifiedName(), createTestCaseResult, ADMIN_AUTH_HEADERS);
    }

    for (int i = 11; i <= 20; i++) {
      createTestCaseResult =
          new CreateTestCaseResult()
              .withResult("result")
              .withTestCaseStatus(TestCaseStatus.Success)
              .withTimestamp(TestUtils.dateToTimestamp(dateStr + i));
      postTestCaseResult(
          testCase1.getFullyQualifiedName(), createTestCaseResult, ADMIN_AUTH_HEADERS);
    }

    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();
    CreateTestSuite createLogicalTestSuite = testSuiteResourceTest.createRequest(test);
    TestSuite logicalTestSuite =
        testSuiteResourceTest.createEntity(createLogicalTestSuite, ADMIN_AUTH_HEADERS);
    List<UUID> testCaseIds = new ArrayList<>();
    testCaseIds.add(testCase1.getId());
    testSuiteResourceTest.addTestCasesToLogicalTestSuite(logicalTestSuite, testCaseIds);

    testSuiteResourceTest.getEntity(testCase.getTestSuite().getId(), "*", ADMIN_AUTH_HEADERS);
    if (supportsSearchIndex) {
      // test we get the right summary for the executable test suite
      getAndValidateTestSummary(testCase.getTestSuite().getId().toString());
    }

    // test we get the right summary for the logical test suite

    if (supportsSearchIndex) {
      getAndValidateTestSummary(logicalTestSuite.getId().toString());
    }
    testCaseIds.clear();
    testCaseIds.add(testCase.getId());
    testSuiteResourceTest.addTestCasesToLogicalTestSuite(logicalTestSuite, testCaseIds);
    if (supportsSearchIndex) {
      getAndValidateTestSummary(logicalTestSuite.getId().toString());
    }
    deleteEntity(testCase1.getId(), ADMIN_AUTH_HEADERS);
    ResultList<TestCaseResult> resultList =
        getTestCaseResults(
            testCase1.getFullyQualifiedName(),
            TestUtils.dateToTimestamp("2021-10-01"),
            TestUtils.dateToTimestamp("2021-10-30"),
            ADMIN_AUTH_HEADERS);
    assertNotEquals(
        resultList.getData().size(), 0); // soft deletion should not delete existing results

    if (supportsSearchIndex) {
      getAndValidateTestSummary(testCase.getTestSuite().getId().toString());
      getAndValidateTestSummary(logicalTestSuite.getId().toString());
    }

    deleteEntity(testCase1.getId(), true, true, ADMIN_AUTH_HEADERS); // hard delete
    assertResponse(
        () ->
            getTestCaseResults(
                testCase1.getFullyQualifiedName(),
                TestUtils.dateToTimestamp("2021-10-01"),
                TestUtils.dateToTimestamp("2021-10-30"),
                ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        "testCase instance for " + testCase1.getFullyQualifiedName() + " not found");

    if (supportsSearchIndex) {
      getAndValidateTestSummary(testCase.getTestSuite().getId().toString());
      getAndValidateTestSummary(logicalTestSuite.getId().toString());
    }
    // check the deletion of the test case from the executable test suite
    // cascaded to the logical test suite
    deleteLogicalTestCase(logicalTestSuite, testCase.getId());

    if (supportsSearchIndex) {
      getAndValidateTestSummary(logicalTestSuite.getId().toString());
    }
  }

  @Test
  void test_createMany(TestInfo test) throws HttpResponseException {
    List<CreateTestCase> createTestCases = new ArrayList<>();
    for (int i = 0; i < 10; i++) {
      CreateTestCase createTestCase = createRequest(test, i);
      if (i % 2 == 0) {
        createTestCase.withEntityLink(TABLE_LINK);
      } else {
        createTestCase.withEntityLink(TABLE_LINK_2);
      }
      createTestCases.add(createTestCase);
    }
    List<Map<String, Object>> testCases = createManyTestCases(createTestCases);
    for (Map<String, Object> testCase : testCases) {
      TestCase storedTestCase =
          getTestCase(
              (String) testCase.get("fullyQualifiedName"),
              Map.of("fields", "testSuite,testDefinition"),
              ADMIN_AUTH_HEADERS);
      CreateTestCase createTestCase =
          createTestCases.stream()
              .filter(t -> t.getName().equals(storedTestCase.getName()))
              .findFirst()
              .get();
      validateCreatedEntity(storedTestCase, createTestCase, ADMIN_AUTH_HEADERS);
    }

    for (Map<String, Object> testCase : testCases) {
      String entityLink = (String) testCase.get("entityLink");
      ResultList<TestCase> testCasesFromSearch =
          listEntitiesFromSearch(Map.of("entityLink", entityLink), 100, 0, ADMIN_AUTH_HEADERS);
      testCasesFromSearch.getData().stream()
          .filter(t -> t.getId().toString().equals(testCase.get("id")))
          .findFirst()
          .orElseThrow();
    }
  }

  @Test
  void test_createTestCaseWithOrPermissions() throws Exception {
    CreateTestCase createReq =
        new CreateTestCase()
            .withName("TestCase_OrPerms")
            .withDescription("Simple test case")
            .withTestDefinition(TEST_DEFINITION4.getFullyQualifiedName())
            .withEntityLink(TABLE_LINK);

    // 1) user-table-edit-tests -> Allowed
    TestCase testCase1 = createEntity(createReq, authHeaders("user-table-edit-tests"));
    assertNotNull(testCase1);

    // 2) user-test-case-create -> Allowed
    CreateTestCase createReq2 = createReq.withName("TestCase_OrPerms_2");
    TestCase testCase2 = createEntity(createReq2, authHeaders("user-test-case-create"));
    assertNotNull(testCase2);

    // 3) user-no-perms -> Forbidden
    CreateTestCase createReq3 = createReq.withName("TestCaseNoPermFail");
    TestUtils.assertResponse(
        () -> createEntity(createReq3, authHeaders("user-no-perms")),
        FORBIDDEN,
        "User does not have ANY of the required permissions.");
  }

  @Test
  void test_updateTestCaseOrPermissions() throws Exception {

    CreateTestCase createReq =
        new CreateTestCase()
            .withName("MyTestCaseUpdate")
            .withDescription("Initial desc")
            .withTestDefinition(TEST_DEFINITION4.getFullyQualifiedName())
            .withEntityLink(TABLE_LINK);

    TestCase testCase = createEntity(createReq, ADMIN_AUTH_HEADERS);

    CreateTestCase updateReq = createReq.withDescription("Updated desc");

    TestCase updatedByTable = updateEntity(updateReq, OK, authHeaders("user-table-edit-tests"));
    assertEquals("Updated desc", updatedByTable.getDescription());

    CreateTestCase updateReq2 = updateReq.withDescription("Updated again by testCaseUpdate user");
    TestCase updatedByTestCase = updateEntity(updateReq2, OK, authHeaders("user-test-case-update"));
    assertEquals("Updated again by testCaseUpdate user", updatedByTestCase.getDescription());

    CreateTestCase updateReq3 = updateReq.withDescription("Should fail");
    TestUtils.assertResponse(
        () -> updateEntity(updateReq3, OK, authHeaders("user-no-perms")),
        FORBIDDEN,
        "User does not have ANY of the required permissions.");
  }

  @Test
  void test_testCaseCrudByTableOwner_withTemporaryOwnership() throws Exception {
    String tableOwnerUsername = "user-table-owner";
    TableResourceTest tableResourceTest = new TableResourceTest();
    Table tableEntity =
        tableResourceTest.getEntity(TEST_TABLE1.getId(), "owners", ADMIN_AUTH_HEADERS);
    List<EntityReference> originalOwners =
        tableEntity.getOwners() == null ? List.of() : tableEntity.getOwners();

    String originalTableJson = JsonUtils.pojoToJson(tableEntity);
    try {
      tableEntity.setOwners(List.of(USER_TABLE_OWNER.getEntityReference()));
      tableResourceTest.patchEntity(
          tableEntity.getId(), originalTableJson, tableEntity, ADMIN_AUTH_HEADERS);

      CreateTestCase createReq =
          new CreateTestCase()
              .withName("TempOwnerTestCase")
              .withDescription("TestCase by temporarily assigned table owner")
              .withTestDefinition(TEST_DEFINITION4.getFullyQualifiedName())
              .withEntityLink(TABLE_LINK);

      TestCase created = createEntity(createReq, authHeaders(tableOwnerUsername));
      assertNotNull(created);

      CreateTestCase updateReq =
          createReq.withDescription("Updated description by temporary owner");
      TestCase updated = updateEntity(updateReq, OK, authHeaders(tableOwnerUsername));
      assertEquals("Updated description by temporary owner", updated.getDescription());

      deleteAndCheckEntity(updated, authHeaders(tableOwnerUsername));

    } finally {
      String modifiedTableJson = JsonUtils.pojoToJson(tableEntity);
      tableEntity.setOwners(originalOwners);
      tableResourceTest.patchEntity(
          tableEntity.getId(), modifiedTableJson, tableEntity, ADMIN_AUTH_HEADERS);
    }
  }

  @Test
  void test_tableOwnerCannotCrudOtherTables() {
    // If the user is an owner of "TABLE_LINK" but tries to create
    // a testCase referencing a different table they do NOT own,
    // then the condition isOwner() => false => no permissions => fail.
    CreateTestCase createReq =
        new CreateTestCase()
            .withName("OwnerFailOtherTableCase")
            .withDescription("Fail if referencing a table not owned by user-table-owner")
            .withTestDefinition(TEST_DEFINITION1.getFullyQualifiedName())
            .withEntityLink(TABLE_LINK_2); // A table the user does not own

    TestUtils.assertResponse(
        () -> createEntity(createReq, authHeaders("user-table-owner")),
        FORBIDDEN,
        "User does not have ANY of the required permissions.");
  }

  @Test
  void test_testCaseCrudByUserWithDirectTestCasePermissions() throws Exception {
    CreateTestCase createReq =
        new CreateTestCase()
            .withName("AllOpsTestCase")
            .withDescription("TestCase with direct testCase perms")
            .withTestDefinition(TEST_DEFINITION4.getFullyQualifiedName())
            .withEntityLink(TABLE_LINK);

    TestCase testCase = createEntity(createReq, authHeaders("user-test-case-all-ops"));
    assertNotNull(testCase);

    CreateTestCase updateReq = createReq.withDescription("Updated by direct testCase perms user");
    TestCase updated = updateEntity(updateReq, OK, authHeaders("user-test-case-all-ops"));
    assertEquals("Updated by direct testCase perms user", updated.getDescription());

    deleteAndCheckEntity(updated, authHeaders("user-test-case-all-ops"));
  }

  @Test
  void test_testCaseCrudByUserWithDirectTestCasePermissions_negative() throws Exception {
    // A user who does NOT have CREATE, for example, or is missing one of them -> fails

    CreateTestCase createReq =
        new CreateTestCase()
            .withName("NoDeleteUserCase")
            .withDescription("Will fail on deletion")
            .withTestDefinition(TEST_DEFINITION4.getFullyQualifiedName())
            .withEntityLink(TABLE_LINK);

    TestCase testCase = createEntity(createReq, authHeaders("user-test-case-create"));
    assertNotNull(testCase);

    TestUtils.assertResponse(
        () -> deleteAndCheckEntity(testCase, authHeaders("user-test-case-create")),
        FORBIDDEN,
        permissionNotAllowed("user-test-case-create", List.of(DELETE)));
  }

  // Test utils methods

  public ResultList<TestCaseResult> listTestCaseResultsFromSearch(
      Map<String, String> queryParams,
      Integer limit,
      Integer offset,
      String path,
      Map<String, String> authHeader)
      throws HttpResponseException {
    WebTarget target = getCollection().path(path);
    for (Map.Entry<String, String> entry : queryParams.entrySet()) {
      target = target.queryParam(entry.getKey(), entry.getValue());
    }
    target = limit != null ? target.queryParam("limit", limit) : target;
    target = offset != null ? target.queryParam("offset", offset) : target;
    return TestUtils.get(target, TestCaseResultResource.TestCaseResultList.class, authHeader);
  }

  protected void validateListTestCaseResultsFromSearchWithPagination(
      Map<String, String> queryParams, Integer maxEntities, String path) throws IOException {
    // List all entities and use it for checking pagination
    Random rand = new Random();

    for (Include include : List.of(Include.NON_DELETED, Include.ALL)) {
      queryParams.put("include", include.value());

      ResultList<TestCaseResult> allEntities =
          listTestCaseResultsFromSearch(queryParams, 1000, 0, path, ADMIN_AUTH_HEADERS);
      int totalRecords = allEntities.getData().size();

      ResultList<TestCaseResult> forwardPage;
      ResultList<TestCaseResult> backwardPage;
      int offset;
      int cumEntityCount;
      // List entity with "limit" set from 1 to maxEntities size with random jumps
      for (int limit = 1; limit <= maxEntities; limit += rand.nextInt(5) + 1) {
        offset = 0;
        cumEntityCount = 0;
        int pageCount = 0;
        do {
          LOG.debug(
              "Limit {} forward pageCount {} totalRecords {} offset {}",
              limit,
              pageCount,
              totalRecords,
              offset);
          forwardPage =
              listTestCaseResultsFromSearch(queryParams, limit, offset, path, ADMIN_AUTH_HEADERS);
          assertEntityPagination(allEntities.getData(), forwardPage, limit, offset);

          if (pageCount == 0) { // First page is being returned. Offset should be 0
            assertEquals(offset, 0);
          } else {
            // Make sure scrolling back based on offset - limit cursor returns the correct result
            listTestCaseResultsFromSearch(
                queryParams, limit, (offset - limit), path, ADMIN_AUTH_HEADERS);
            assertEntityPagination(allEntities.getData(), forwardPage, limit, offset);
          }
          offset = offset + limit;
          cumEntityCount += forwardPage.getData().size();
          pageCount++;
        } while (offset < totalRecords);

        // We reached the end of the page check total cum number matches total records and paginate
        // backward
        assertEquals(totalRecords, cumEntityCount);

        pageCount = 0;
        cumEntityCount = 0;

        do {
          LOG.debug(
              "Limit {} backward pageCount {} totalRecords {} offset {}",
              limit,
              pageCount,
              totalRecords,
              offset);
          offset = offset - limit;
          backwardPage =
              listTestCaseResultsFromSearch(queryParams, limit, offset, path, ADMIN_AUTH_HEADERS);
          assertEntityPagination(allEntities.getData(), backwardPage, limit, offset);
          cumEntityCount += backwardPage.getData().size();
          pageCount++;
        } while (offset > 0);
      }
    }
  }

  public TestCaseResult postTestCaseResult(
      String fqn, CreateTestCaseResult data, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(testCaseResultsCollectionName).path("/" + fqn);
    return TestUtils.post(target, data, TestCaseResult.class, authHeaders);
  }

  public void deleteTestCaseResult(String fqn, Long timestamp, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(testCaseResultsCollectionName).path("/" + fqn + "/" + timestamp);
    TestUtils.delete(target, authHeaders);
  }

  private TestSuite createExecutableTestSuite(TestInfo test) throws IOException {
    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();
    TableResourceTest tableResourceTest = new TableResourceTest();
    CreateTable tableReq =
        tableResourceTest
            .createRequest(test)
            .withName(test.getDisplayName())
            .withDatabaseSchema(DATABASE_SCHEMA.getFullyQualifiedName())
            .withOwners(List.of(USER1_REF))
            .withColumns(
                List.of(
                    new Column()
                        .withName(C1)
                        .withDisplayName("c1")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(10)))
            .withOwners(List.of(USER1_REF));
    Table table = tableResourceTest.createAndCheckEntity(tableReq, ADMIN_AUTH_HEADERS);
    CreateTestSuite createExecutableTestSuite =
        testSuiteResourceTest.createRequest(table.getFullyQualifiedName());
    return testSuiteResourceTest.createBasicTestSuite(
        createExecutableTestSuite, ADMIN_AUTH_HEADERS);
  }

  private void deleteLogicalTestCase(TestSuite testSuite, UUID testCaseId) throws IOException {
    WebTarget target =
        getCollection()
            .path(
                "/logicalTestCases/" + testSuite.getId().toString() + "/" + testCaseId.toString());
    TestUtils.delete(target, ADMIN_AUTH_HEADERS);
  }

  private boolean assertTestCaseIdNotInList(
      ResultList<TestCase> testCaseResultList, UUID testCaseId) {
    return testCaseResultList.getData().stream()
        .noneMatch(testCase -> testCase.getId().equals(testCaseId));
  }

  public ResultList<TestCaseResult> getTestCaseResults(
      String fqn, Long start, Long end, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(testCaseResultsCollectionName).path("/" + fqn);
    target = target.queryParam("startTs", start);
    target = target.queryParam("endTs", end);
    return TestUtils.get(target, TestCaseResource.TestCaseResultList.class, authHeaders);
  }

  public TestCase getTestCase(
      String fqn, Map<String, String> params, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getCollection().path("/name/" + fqn);
    for (Map.Entry<String, String> entry : params.entrySet()) {
      target = target.queryParam(entry.getKey(), entry.getValue());
    }
    return TestUtils.get(target, TestCase.class, authHeaders);
  }

  private TestCase getTestCase(String fqn, Map<String, String> authHeaders)
      throws HttpResponseException {
    Map<String, String> params = Map.of("fields", "incidentId,inspectionQuery");
    return getTestCase(fqn, params, authHeaders);
  }

  private TestSummary getTestSummary(String testSuiteId) throws IOException {
    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();
    return testSuiteResourceTest.getTestSummary(ADMIN_AUTH_HEADERS, testSuiteId);
  }

  private void getAndValidateTestSummary(String testSuiteId) throws IOException {
    // Retry logic to handle ES async operations
    int maxRetries = 5;
    int retries = 0;

    while (true) {
      try {
        TestSummary testSummary = getTestSummary(testSuiteId);
        validateTestSummary(testSummary, testSuiteId);
        break;
      } catch (Exception e) {
        if (retries++ >= maxRetries) {
          throw e;
        }
      }
    }
  }

  private void validateTestSummary(TestSummary testSummary, String testSuiteId)
      throws HttpResponseException {
    HashMap<String, Integer> testSummaryMap = JsonUtils.convertValue(testSummary, HashMap.class);
    List<TestCase> testCases;

    HashMap<String, HashMap<String, Integer>> columnsMap = new HashMap<>();
    HashMap<String, Integer> map = new HashMap<>(5);
    map.put("success", 0);
    map.put("failed", 0);
    map.put("aborted", 0);
    map.put("queued", 0);
    map.put("total", 0);
    HashMap<String, String> params = new HashMap<>();

    if (testSuiteId != null) {
      params.put("testSuiteId", testSuiteId);
    }
    params.put("fields", "testCaseResult");
    params.put("limit", "10000");
    params.put("include", "non-deleted");

    ResultList<TestCase> testCaseList = listEntities(params, ADMIN_AUTH_HEADERS);
    testCases = testCaseList.getData();
    for (TestCase testCase : testCases) {
      TestCaseResult testCaseResult = testCase.getTestCaseResult();
      if (testCaseResult == null) {
        continue;
      }

      MessageParser.EntityLink entityLink =
          testCase.getEntityLink() != null
              ? MessageParser.EntityLink.parse(testCase.getEntityLink())
              : null;
      if (entityLink != null
          && entityLink.getFieldName() != null
          && entityLink.getFieldName().equals("columns")
          && testSuiteId != null) {
        HashMap<String, Integer> columnMap =
            columnsMap.get(entityLink.getFullyQualifiedFieldValue());
        if (columnMap == null) {
          columnMap = new HashMap<>(5);
          columnMap.put("success", 0);
          columnMap.put("failed", 0);
          columnMap.put("aborted", 0);
          columnMap.put("queued", 0);
          columnMap.put("total", 0);
          columnsMap.put(entityLink.getLinkString(), columnMap);
        }
        columnMap.merge(
            testCaseResult.getTestCaseStatus().toString().toLowerCase(), 1, Integer::sum);
        columnMap.merge("total", 1, Integer::sum);
      }
      map.merge(testCaseResult.getTestCaseStatus().toString().toLowerCase(), 1, Integer::sum);
      map.merge("total", 1, Integer::sum);
    }

    for (Map.Entry<String, Integer> entry : map.entrySet()) {
      assertEquals(entry.getValue(), testSummaryMap.get(entry.getKey()));
    }

    if (testSuiteId != null) {
      // we validate column summary is set properly when requesting summary at the column level
      List<ColumnTestSummaryDefinition> columnTestSummary = testSummary.getColumnTestSummary();
      assertEquals(columnsMap.size(), columnTestSummary.size());
      for (ColumnTestSummaryDefinition columnTestSummaryDefinition : columnTestSummary) {
        HashMap<String, Integer> columnSummary =
            JsonUtils.convertValue(columnTestSummaryDefinition, HashMap.class);
        HashMap<String, Integer> columnMap =
            columnsMap.get(columnTestSummaryDefinition.getEntityLink());
        for (Map.Entry<String, Integer> entry : columnMap.entrySet()) {
          assertEquals(entry.getValue(), columnSummary.get(entry.getKey()));
        }
      }
    }
  }

  public ResultList<TestCase> getTestCases(
      Map<String, Object> queryParams, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getCollection();
    for (Map.Entry<String, Object> entry : queryParams.entrySet()) {
      if (entry.getValue() == null || entry.getValue().toString().isEmpty()) {
        continue;
      }
      target = target.queryParam(entry.getKey(), entry.getValue());
    }
    return TestUtils.get(target, TestCaseResource.TestCaseList.class, authHeaders);
  }

  private void patchTestCaseResult(String testCaseFqn, Long timestamp, JsonNode patch)
      throws HttpResponseException {
    WebTarget target =
        getResource(testCaseResultsCollectionName).path("/" + testCaseFqn + "/" + timestamp);
    TestUtils.patch(target, patch, TestCaseResult.class, ADMIN_AUTH_HEADERS);
  }

  private void verifyTestCaseResults(
      ResultList<TestCaseResult> actualTestCaseResults,
      List<TestCaseResult> expectedTestCaseResults,
      int expectedCount) {
    assertEquals(expectedCount, actualTestCaseResults.getPaging().getTotal());
    assertEquals(expectedTestCaseResults.size(), actualTestCaseResults.getData().size());
    Map<Long, TestCaseResult> testCaseResultMap = new HashMap<>();
    for (TestCaseResult result : actualTestCaseResults.getData()) {
      testCaseResultMap.put(result.getTimestamp(), result);
    }
    for (TestCaseResult result : expectedTestCaseResults) {
      TestCaseResult storedTestCaseResult = testCaseResultMap.get(result.getTimestamp());
      verifyTestCaseResult(storedTestCaseResult, result);
    }
  }

  private void verifyTestCases(
      ResultList<TestCase> actualTestCases,
      List<CreateTestCase> expectedTestCases,
      int expectedCount) {
    assertEquals(expectedCount, actualTestCases.getPaging().getTotal());
    assertEquals(expectedTestCases.size(), actualTestCases.getData().size());
    Map<String, TestCase> testCaseMap = new HashMap<>();
    for (TestCase result : actualTestCases.getData()) {
      testCaseMap.put(result.getName(), result);
    }
    for (CreateTestCase result : expectedTestCases) {
      TestCase storedTestCase = testCaseMap.get(result.getName());
      validateCreatedEntity(storedTestCase, result, ADMIN_AUTH_HEADERS);
    }
  }

  private void verifyTestCaseResult(TestCaseResult expected, TestCaseResult actual) {
    assertEquals(expected, actual); // Ignore id as set on create
    try {
      verifyTestCaseResultInIndex(expected);
    } catch (IOException e) {
      Assertions.fail("Failed to verify test case result in index: %s" + e.getMessage());
    }
  }

  private void verifyTestCaseResultInIndex(TestCaseResult dbTestCaseResult) throws IOException {
    // Try to search entity with INCOMPLETE description
    RestClient searchClient = getSearchClient();
    IndexMapping index = Entity.getSearchRepository().getIndexMapping(Entity.TEST_CASE_RESULT);
    Response response;
    Request request =
        new Request(
            "GET",
            String.format(
                "%s/_search", index.getIndexName(Entity.getSearchRepository().getClusterAlias())));
    String query =
        String.format(
            "{\"size\": 10,\"query\":{\"bool\":{\"must\":[{\"term\":{\"_id\":\"%s\"}}]}}}",
            dbTestCaseResult.getId().toString());
    request.setJsonEntity(query);
    try {
      response = searchClient.performRequest(request);
    } finally {
      searchClient.close();
    }
    String jsonString = EntityUtils.toString(response.getEntity());
    HashMap<String, Object> map =
        (HashMap<String, Object>) JsonUtils.readOrConvertValue(jsonString, HashMap.class);
    LinkedHashMap<String, Object> hits = (LinkedHashMap<String, Object>) map.get("hits");
    ArrayList<LinkedHashMap<String, Object>> hitsList =
        (ArrayList<LinkedHashMap<String, Object>>) hits.get("hits");
    assertNotEquals(0, hitsList.size());
    assertTrue(
        hitsList.stream()
            .allMatch(
                hit ->
                    ((LinkedHashMap<String, Object>) hit.get("_source"))
                        .get("id")
                        .equals(dbTestCaseResult.getId().toString())));
  }

  @Override
  public CreateTestCase createRequest(String name) {
    return new CreateTestCase()
        .withName(name)
        .withDescription(name)
        .withEntityLink(TABLE_LINK)
        .withTestDefinition(TEST_DEFINITION4.getFullyQualifiedName());
  }

  public CreateTestCase createRequest(String name, MessageParser.EntityLink entityLink) {
    return new CreateTestCase()
        .withName(name)
        .withDescription(name)
        .withEntityLink(entityLink.getLinkString())
        .withTestDefinition(TEST_DEFINITION4.getFullyQualifiedName());
  }

  @Override
  public void validateCreatedEntity(
      TestCase createdEntity, CreateTestCase request, Map<String, String> authHeaders) {
    validateCommonEntityFields(createdEntity, request, getPrincipalName(authHeaders));
    assertEquals(request.getEntityLink(), createdEntity.getEntityLink());
    assertReference(request.getTestDefinition(), createdEntity.getTestDefinition());
    assertEquals(request.getParameterValues(), createdEntity.getParameterValues());
  }

  @Override
  public void compareEntities(
      TestCase expected, TestCase updated, Map<String, String> authHeaders) {
    validateCommonEntityFields(expected, updated, getPrincipalName(authHeaders));
    assertEquals(expected.getEntityLink(), updated.getEntityLink());
    assertEquals(expected.getTestSuite(), updated.getTestSuite());
    assertEquals(expected.getTestDefinition(), updated.getTestDefinition());
    assertEquals(expected.getTestSuite(), updated.getTestSuite());
    assertEquals(expected.getParameterValues(), updated.getParameterValues());
  }

  @Override
  public TestCase validateGetWithDifferentFields(TestCase entity, boolean byName)
      throws HttpResponseException {
    String fields = "";
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), null, ADMIN_AUTH_HEADERS);
    assertListNull(entity.getOwners(), entity.getTestSuite(), entity.getTestDefinition());

    fields = "owners,testSuite,testDefinition";
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(entity.getOwners(), entity.getTestSuite(), entity.getTestDefinition());
    return entity;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    if (expected == actual) {
      return;
    }
    if (fieldName.equals("parameterValues")) {
      assertEquals(JsonUtils.pojoToJson(expected), JsonUtils.pojoToJson(actual));
    } else if (fieldName.equals("testDefinition")) {
      assertEntityReferenceFieldChange(expected, actual);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }

  public ResultList<TestCaseResolutionStatus> getTestCaseFailureStatus(
      Long startTs,
      Long endTs,
      String assignee,
      TestCaseResolutionStatusTypes testCaseResolutionStatusType,
      Map<String, String> fields)
      throws HttpResponseException {
    WebTarget target = getCollection().path("/testCaseIncidentStatus");
    for (Map.Entry<String, String> entry : fields.entrySet()) {
      target = target.queryParam(entry.getKey(), entry.getValue());
    }
    target = target.queryParam("startTs", startTs);
    target = target.queryParam("endTs", endTs);
    target = assignee != null ? target.queryParam("assignee", assignee) : target;
    target =
        testCaseResolutionStatusType != null
            ? target.queryParam("testCaseResolutionStatusType", testCaseResolutionStatusType)
            : target;
    return TestUtils.get(
        target,
        TestCaseResolutionStatusResource.TestCaseResolutionStatusResultList.class,
        ADMIN_AUTH_HEADERS);
  }

  public ResultList<TestCaseResolutionStatus> getTestCaseFailureStatus(
      Long startTs,
      Long endTs,
      String assignee,
      TestCaseResolutionStatusTypes testCaseResolutionStatusType)
      throws HttpResponseException {
    return getTestCaseFailureStatus(
        startTs, endTs, assignee, testCaseResolutionStatusType, new HashMap<>());
  }

  private TestCaseResolutionStatus getTestCaseFailureStatusById(UUID id)
      throws HttpResponseException {
    String pathUrl = "/testCaseIncidentStatus/" + id;
    WebTarget target = getCollection().path(pathUrl);
    return TestUtils.get(target, TestCaseResolutionStatus.class, ADMIN_AUTH_HEADERS);
  }

  private ResultList<TestCaseResolutionStatus> getTestCaseFailureStatusByStateId(UUID id)
      throws HttpResponseException {
    String pathUrl = "/testCaseIncidentStatus/stateId/" + id;
    WebTarget target = getCollection().path(pathUrl);
    return TestUtils.get(
        target,
        TestCaseResolutionStatusResource.TestCaseResolutionStatusResultList.class,
        ADMIN_AUTH_HEADERS);
  }

  private List<Map<String, Object>> createManyTestCases(List<CreateTestCase> createTestCases)
      throws HttpResponseException {
    String pathUrl = "/createMany/";
    WebTarget target = getCollection().path(pathUrl);
    return TestUtils.post(
        target, createTestCases, List.class, OK.getStatusCode(), ADMIN_AUTH_HEADERS);
  }

  private ResultList<TestCaseResolutionStatus> getTestCaseFailureStatus(
      int limit, String offset, Boolean latest, Long startTs, Long endTs, String testCaseFqn)
      throws HttpResponseException {
    WebTarget target = getCollection().path("/testCaseIncidentStatus");
    target = target.queryParam("limit", limit);
    target = offset != null ? target.queryParam("offset", offset) : target;
    target =
        latest != null ? target.queryParam("latest", latest) : target.queryParam("latest", false);
    target = testCaseFqn != null ? target.queryParam("entityFQNHash", testCaseFqn) : target;

    target =
        startTs != null
            ? target.queryParam("startTs", startTs)
            : target.queryParam("startTs", System.currentTimeMillis() - 100000);
    target =
        endTs != null
            ? target.queryParam("endTs", endTs)
            : target.queryParam("endTs", System.currentTimeMillis() + 100000);

    return TestUtils.get(
        target,
        TestCaseResolutionStatusResource.TestCaseResolutionStatusResultList.class,
        ADMIN_AUTH_HEADERS);
  }

  private TestCaseResolutionStatus createTestCaseFailureStatus(
      CreateTestCaseResolutionStatus createTestCaseFailureStatus) throws HttpResponseException {
    WebTarget target = getCollection().path("/testCaseIncidentStatus");
    return TestUtils.post(
        target,
        createTestCaseFailureStatus,
        TestCaseResolutionStatus.class,
        200,
        ADMIN_AUTH_HEADERS);
  }

  private TestCaseResolutionStatus patchTestCaseResultFailureStatus(
      UUID testCaseFailureStatusId, JsonNode patch) throws HttpResponseException {
    WebTarget target = getCollection().path("/testCaseIncidentStatus/" + testCaseFailureStatusId);
    return TestUtils.patch(target, patch, TestCaseResolutionStatus.class, ADMIN_AUTH_HEADERS);
  }

  private TestCaseResolutionStatus getTestCaseFailureStatus(UUID testCaseFailureStatusId)
      throws HttpResponseException {
    WebTarget target = getCollection().path("/testCaseIncidentStatus/" + testCaseFailureStatusId);
    return TestUtils.get(target, TestCaseResolutionStatus.class, ADMIN_AUTH_HEADERS);
  }

  private void paginateTestCaseFailureStatus(
      Integer maxEntities,
      ResultList<TestCaseResolutionStatus> allEntities,
      Long startTs,
      Long endTs)
      throws HttpResponseException {
    Random random = new Random();
    int totalRecords = allEntities.getData().size();

    for (int limit = 1; limit < maxEntities; limit += random.nextInt(5) + 1) {
      String after = null;
      String before;
      int pageCount = 0;
      int indexInAllTables = 0;
      ResultList<TestCaseResolutionStatus> forwardPage;
      ResultList<TestCaseResolutionStatus> backwardPage;
      do { // For each limit (or page size) - forward scroll till the end
        forwardPage = getTestCaseFailureStatus(limit, after, null, startTs, endTs, null);
        after = forwardPage.getPaging().getAfter();
        before = forwardPage.getPaging().getBefore();
        assertEntityPagination(allEntities.getData(), forwardPage, limit, indexInAllTables);

        if (pageCount == 0) { // CASE 0 - First page is being returned. There is no before-cursor
          assertNull(before);
        } else {
          // Make sure scrolling back based on before cursor returns the correct result
          backwardPage = getTestCaseFailureStatus(limit, before, null, startTs, endTs, null);
          assertEntityPagination(
              allEntities.getData(), backwardPage, limit, (indexInAllTables - limit));
        }

        indexInAllTables += forwardPage.getData().size();
        pageCount++;
      } while (after != null);

      // We have now reached the last page - test backward scroll till the beginning
      pageCount = 0;
      indexInAllTables = totalRecords - limit - forwardPage.getData().size();
      do {
        forwardPage = getTestCaseFailureStatus(limit, before, null, startTs, endTs, null);
        before = forwardPage.getPaging().getBefore();
        assertEntityPagination(allEntities.getData(), forwardPage, limit, indexInAllTables);
        pageCount++;
        indexInAllTables -= forwardPage.getData().size();
      } while (before != null);
    }
  }

  @Test
  void aggregate_testCaseResults(TestInfo testInfo) throws IOException, ParseException {
    // Set up tests
    SearchRepository searchRepository = Entity.getSearchRepository();
    CreateTestCase create = createRequest(testInfo);
    create
        .withEntityLink(TABLE_COLUMN_LINK)
        .withTestDefinition(TEST_DEFINITION3.getFullyQualifiedName())
        .withParameterValues(
            List.of(new TestCaseParameterValue().withValue("100").withName("missingCountValue")));
    TestCase testCase = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    for (int i = 1; i < 10; i++) {
      CreateTestCaseResult createTestCaseResult =
          new CreateTestCaseResult()
              .withResult("tested")
              .withTestCaseStatus(TestCaseStatus.Success)
              .withTimestamp(TestUtils.dateToTimestamp("2021-09-0%s".formatted(i)));
      postTestCaseResult(
          testCase.getFullyQualifiedName(), createTestCaseResult, ADMIN_AUTH_HEADERS);
    }

    // Test aggregation
    String aggregationQuery =
        "bucketName=dates:aggType=date_histogram:field=timestamp&calendar_interval=1d,bucketName=dimesion:aggType=terms:field=testDefinition.dataQualityDimension";
    SearchAggregation aggregation = SearchIndexUtils.buildAggregationTree(aggregationQuery);
    DataQualityReport dataQualityReport =
        searchRepository.genericAggregation(null, "testCaseResult", aggregation);
    assertNotNull(dataQualityReport.getData());
  }

  @Test
  void createTestCaseResults_wrongTs(TestInfo testInfo) throws IOException {
    CreateTestCase create = createRequest(testInfo);
    TestCase testCase = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    CreateTestCaseResult createTestCaseResult =
        new CreateTestCaseResult()
            .withResult("result")
            .withTestCaseStatus(TestCaseStatus.Failed)
            .withTimestamp(1725521153L);
    assertResponse(
        () ->
            postTestCaseResult(
                testCase.getFullyQualifiedName(), createTestCaseResult, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Timestamp 1725521153 is not valid, it should be in milliseconds since epoch");
  }

  @Test
  void test_listTestCaseFromSearch(TestInfo testInfo) throws HttpResponseException, ParseException {
    CreateTestCase create = createRequest(testInfo);
    create
        .withEntityLink(TABLE_COLUMN_LINK)
        .withTestDefinition(TEST_DEFINITION3.getFullyQualifiedName())
        .withParameterValues(
            List.of(new TestCaseParameterValue().withValue("100").withName("missingCountValue")));
    TestCase testCase = createEntity(create, ADMIN_AUTH_HEADERS);
    for (int i = 1; i < 10; i++) {
      CreateTestCaseResult createTestCaseResult =
          new CreateTestCaseResult()
              .withResult("tested")
              .withTestCaseStatus(TestCaseStatus.Success)
              .withTimestamp(TestUtils.dateToTimestamp("2021-09-0%s".formatted(i)));
      postTestCaseResult(
          testCase.getFullyQualifiedName(), createTestCaseResult, ADMIN_AUTH_HEADERS);
    }

    Map<String, String> queryParams = new HashMap<>();

    queryParams.put("fields", "testCase,testDefinition");
    ResultList<TestCaseResult> testCaseResultResultList =
        listTestCaseResultsFromSearch(
            queryParams, 10, 0, "/testCaseResults/search/list", ADMIN_AUTH_HEADERS);
    assertNotEquals(testCaseResultResultList.getData().size(), 0);
    testCaseResultResultList
        .getData()
        .forEach(
            testCaseResult -> {
              assertNotNull(testCaseResult.getTestCase());
              assertNotNull(testCaseResult.getTestDefinition());
            });

    queryParams.clear();
    Long ts = TestUtils.dateToTimestamp("2021-09-01");
    queryParams.put("startTimestamp", ts.toString());
    queryParams.put("endTimestamp", TestUtils.dateToTimestamp("2021-09-01").toString());
    queryParams.put("latest", "true");
    queryParams.put("testSuiteId", testCase.getTestSuite().getId().toString());

    testCaseResultResultList =
        listTestCaseResultsFromSearch(
            queryParams, 10, 0, "/testCaseResults/search/list", ADMIN_AUTH_HEADERS);
    assertNotEquals(testCaseResultResultList.getData().size(), 0);
    testCaseResultResultList
        .getData()
        .forEach(testCaseResult -> assertEquals(testCaseResult.getTimestamp(), ts));

    queryParams.clear();
    queryParams.put("dataQualityDimension", "Completeness");
    queryParams.put("fields", "testDefinition");
    testCaseResultResultList =
        listTestCaseResultsFromSearch(
            queryParams, 10, 0, "/testCaseResults/search/list", ADMIN_AUTH_HEADERS);
    assertNotEquals(testCaseResultResultList.getData().size(), 0);
    testCaseResultResultList
        .getData()
        .forEach(
            testCaseResult -> {
              EntityReference testDefinition = testCaseResult.getTestDefinition();
              TestDefinition td =
                  Entity.getEntity(TEST_DEFINITION, testDefinition.getId(), "", Include.ALL);
              assertEquals(td.getDataQualityDimension(), DataQualityDimensions.COMPLETENESS);
            });

    queryParams.clear();
    queryParams.put("testCaseType", "column");
    testCaseResultResultList =
        listTestCaseResultsFromSearch(
            queryParams, 10, 0, "/testCaseResults/search/list", ADMIN_AUTH_HEADERS);
    assertNotEquals(testCaseResultResultList.getData().size(), 0);
    testCaseResultResultList
        .getData()
        .forEach(
            testCaseResult -> {
              TestCase tc = Entity.getEntity(TEST_CASE, testCase.getId(), "", Include.ALL);
              assertTrue(tc.getEntityLink().contains("columns"));
            });

    String id = testCaseResultResultList.getData().get(0).getId().toString();
    queryParams.put(
        "queryString",
        "%7B%22query%22%3A%20%7B%22term%22%3A%20%7B%22id.keyword%22%3A%20%22"
            + id
            + "%22%7D%7D%7D");
    testCaseResultResultList =
        listTestCaseResultsFromSearch(
            queryParams, 10, 0, "/testCaseResults/search/list", ADMIN_AUTH_HEADERS);
    testCaseResultResultList
        .getData()
        .forEach(testCaseResult -> assertEquals(testCaseResult.getId().toString(), id));
  }

  @Test
  void test_testCaseInvalidEntityLinkTest(TestInfo testInfo) throws IOException {
    // Invalid entity link as not parsable by antlr parser
    String entityLink = "<#E::table::special!@#$%^&*()_+[]{}|;:\\'\",./?>";
    CreateTestCase create = createRequest(testInfo);
    create
        .withEntityLink(entityLink)
        .withTestDefinition(TEST_DEFINITION3.getFullyQualifiedName())
        .withParameterValues(
            List.of(new TestCaseParameterValue().withValue("100").withName("missingCountValue")));

    assertThrows(
        HttpResponseException.class,
        () -> createAndCheckEntity(create, ADMIN_AUTH_HEADERS),
        "entityLink must match \"(?U)^<#E::\\w+::[\\w'\\- .&/:+\"\\\\()$#%]+>$\"");

    entityLink = "<#E::table::user<name>::column>";
    create.setEntityLink(entityLink);
    assertThrows(
        HttpResponseException.class,
        () -> createAndCheckEntity(create, ADMIN_AUTH_HEADERS),
        "entityLink must match \"(?U)^<#E::\\w+::[\\w'\\- .&/:+\"\\\\()$#%]+>$\"");

    entityLink = "<#E::table::user>name::column>";
    create.setEntityLink(entityLink);
    assertThrows(
        HttpResponseException.class,
        () -> createAndCheckEntity(create, ADMIN_AUTH_HEADERS),
        "entityLink must match \"(?U)^<#E::\\w+::[\\w'\\- .&/:+\"\\\\()$#%]+>$\"");

    entityLink = "<#E::table::foo<>bar::baz>\");";
    create.setEntityLink(entityLink);
    assertThrows(
        HttpResponseException.class,
        () -> createAndCheckEntity(create, ADMIN_AUTH_HEADERS),
        "entityLink must match \"(?U)^<#E::\\w+::[\\w'\\- .&/:+\"\\\\()$#%]+>$\"");

    entityLink = "<#E::table::::baz>";
    create.setEntityLink(entityLink);
    assertThrows(
        HttpResponseException.class,
        () -> createAndCheckEntity(create, ADMIN_AUTH_HEADERS),
        "entityLink must match \"(?U)^<#E::\\w+::[\\w'\\- .&/:+\"\\\\()$#%]+>$\"");
  }

  @Test
  void test_columnTestCaseValidation(TestInfo testInfo) throws IOException {
    CreateTestCase create = createRequest(testInfo);
    String invalidFieldNameLink =
        "<#E::table::" + TEST_TABLE1.getFullyQualifiedName() + "::invalidField::columnName>";
    create
        .withEntityLink(invalidFieldNameLink)
        .withTestDefinition(TEST_DEFINITION1.getFullyQualifiedName())
        .withParameterValues(
            List.of(new TestCaseParameterValue().withValue("100").withName("missingCountValue")));

    HttpResponseException exception =
        assertThrows(
            HttpResponseException.class,
            () -> createAndCheckEntity(create, ADMIN_AUTH_HEADERS),
            "Invalid field name '%s' for column test case. It should be 'columns'."
                + " e.g. <#E::table::{entityFqn}::columns::{columnName}>");

    String missingFieldNameLink = "<#E::table::" + TEST_TABLE1.getFullyQualifiedName() + ">";
    create.setEntityLink(missingFieldNameLink);

    exception =
        assertThrows(
            HttpResponseException.class,
            () -> createAndCheckEntity(create, ADMIN_AUTH_HEADERS),
            "Column test case must have a field name and an array field name in the entity link."
                + " e.g. <#E::table::{entityFqn}::columns::{columnName}>");
  }

  private void putInspectionQuery(TestCase testCase, String sql) throws IOException {
    TestCase putResponse = putInspectionQuery(testCase.getId(), sql, ADMIN_AUTH_HEADERS);
    assertEquals(sql, putResponse.getInspectionQuery());
  }

  private void putFailedRowsSample(
      TestCase testCase,
      List<String> columns,
      List<List<Object>> rows,
      Map<String, String> authHeaders)
      throws IOException {
    putFailedRowsSample(testCase, columns, rows, authHeaders, Collections.emptyMap());
  }

  private void putFailedRowsSample(
      TestCase testCase,
      List<String> columns,
      List<List<Object>> rows,
      Map<String, String> authHeaders,
      Map<String, String> queryParams)
      throws IOException {
    TableData tableData = new TableData().withColumns(columns).withRows(rows);
    TestCase putResponse =
        putFailedRowsSample(testCase.getId(), tableData, authHeaders, queryParams);
    assertEquals(tableData, putResponse.getFailedRowsSample());

    TableData data = getSampleData(testCase.getId(), ADMIN_AUTH_HEADERS);
    assertEquals(tableData, data);
  }

  private void deleteFailedRowsSample(TestCase testCase) throws IOException {
    WebTarget target = getResource(testCase.getId()).path("/failedRowsSample");
    TestUtils.delete(target, TestCase.class, ADMIN_AUTH_HEADERS);
  }

  public TestCase putFailedRowsSample(
      UUID testCaseId,
      TableData data,
      Map<String, String> authHeaders,
      Map<String, String> queryParams)
      throws HttpResponseException {
    WebTarget target = getResource(testCaseId).path("/failedRowsSample");
    for (Map.Entry<String, String> entry : queryParams.entrySet()) {
      target = target.queryParam(entry.getKey(), entry.getValue());
    }
    return TestUtils.put(target, data, TestCase.class, OK, authHeaders);
  }

  public TestCase putInspectionQuery(UUID testCaseId, String sql, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(testCaseId).path("/inspectionQuery");
    return TestUtils.put(target, sql, TestCase.class, OK, authHeaders);
  }

  public TableData getSampleData(UUID testCaseId, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(testCaseId).path("/failedRowsSample");
    return TestUtils.get(target, TableData.class, authHeaders);
  }

  @Test
  void test_listTestCasesFilterByCreatedBy(TestInfo testInfo) throws IOException {
    if (supportsSearchIndex) {
      // Create test case with admin user
      CreateTestCase adminTestCaseReq =
          createRequest(testInfo)
              .withName("adminTestCase")
              .withEntityLink(TABLE_LINK)
              .withTestDefinition(TEST_DEFINITION4.getFullyQualifiedName());
      TestCase adminTestCase = createAndCheckEntity(adminTestCaseReq, ADMIN_AUTH_HEADERS);

      // Create test case with test user
      CreateTestCase testUserTestCaseReq =
          createRequest(testInfo)
              .withName("testUserTestCase")
              .withEntityLink(TABLE_LINK)
              .withTestDefinition(TEST_DEFINITION4.getFullyQualifiedName());
      TestCase testUserTestCase =
          createAndCheckEntity(testUserTestCaseReq, INGESTION_BOT_AUTH_HEADERS);

      // Test filtering by admin user (by name) in search endpoint
      Map<String, String> queryParams = new HashMap<>();
      queryParams.put("createdBy", ADMIN_USER_NAME);
      ResultList<TestCase> adminTestCases =
          listEntitiesFromSearch(queryParams, 10, 0, ADMIN_AUTH_HEADERS);
      assertTrue(
          adminTestCases.getData().stream()
              .allMatch(tc -> tc.getCreatedBy().equals(ADMIN_USER_NAME)),
          "Should find test case created by admin user");

      // Test filtering by test user (by name) in search endpoint
      queryParams.clear();
      queryParams.put("createdBy", INGESTION_BOT);
      ResultList<TestCase> testUserTestCases =
          listEntitiesFromSearch(queryParams, 10, 0, ADMIN_AUTH_HEADERS);
      assertTrue(
          testUserTestCases.getData().stream()
              .allMatch(tc -> tc.getCreatedBy().equals(INGESTION_BOT)),
          "Should find test case created by test user");

      // Test with list endpoint (non-search)
      Map<String, String> listParams = new HashMap<>();
      listParams.put("createdBy", ADMIN_USER_NAME);
      ResultList<TestCase> listResults = listEntities(listParams, ADMIN_AUTH_HEADERS);
      assertTrue(
          listResults.getData().stream().allMatch(tc -> tc.getCreatedBy().equals(ADMIN_USER_NAME)),
          "List endpoint should also filter by createdBy");

      // Test with list endpoint (non-search)
      listParams.clear();
      listParams.put("createdBy", INGESTION_BOT);
      listResults = listEntities(listParams, ADMIN_AUTH_HEADERS);
      assertTrue(
          listResults.getData().stream().allMatch(tc -> tc.getCreatedBy().equals(INGESTION_BOT)),
          "List endpoint should also filter by createdBy");
    }
  }
}
