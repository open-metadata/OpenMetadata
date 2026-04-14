package org.openmetadata.mcp.tools;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TestCaseRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.dqtests.TestCaseMapper;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.ImpersonationContext;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.CreateResourceContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.util.RestUtil;

@Slf4j
public class CreateTestCaseTool implements McpTool {
  private final TestCaseMapper testCaseMapper = new TestCaseMapper();

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      CatalogSecurityContext catalogSecurityContext,
      Map<String, Object> params) {
    throw new UnsupportedOperationException("CreateTestCaseTool requires limit validation.");
  }

  private TestCase getTestCase(
      String name,
      String description,
      String entityLinkValue,
      String testDefinitionName,
      List<TestCaseParameterValue> parameterValue,
      String updatedBy) {
    return testCaseMapper.createToEntity(
        new CreateTestCase()
            .withName(name)
            .withDisplayName(name)
            .withDescription(description)
            .withEntityLink(entityLinkValue)
            .withParameterValues(parameterValue)
            .withComputePassedFailedRowCount(false)
            .withUseDynamicAssertion(false)
            .withTestDefinition(testDefinitionName),
        updatedBy);
  }

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext catalogSecurityContext,
      Map<String, Object> params) {
    String testDefinitionName = (String) params.get("testDefinitionName");
    String fqn = (String) params.get("fqn");
    if (testDefinitionName == null || testDefinitionName.trim().isEmpty()) {
      throw new IllegalArgumentException("Parameter 'testDefinitionName' is required");
    }
    if (fqn == null || fqn.trim().isEmpty()) {
      throw new IllegalArgumentException("Parameter 'fqn' is required");
    }

    String entityType =
        params.containsKey("entityType") ? (String) params.get("entityType") : "table";
    String description =
        params.containsKey("description")
            ? (String) params.get("description")
            : "Test case created by MCP tool";
    String name =
        params.containsKey("name")
            ? (String) params.get("name")
            : "TestCase_" + System.currentTimeMillis();
    String columnName = params.containsKey("columnName") ? (String) params.get("columnName") : null;
    MessageParser.EntityLink entityLink;
    if (columnName != null && !columnName.trim().isEmpty()) {
      entityLink =
          new MessageParser.EntityLink(entityType, fqn, "columns", columnName.trim(), null);
    } else {
      entityLink = new MessageParser.EntityLink(entityType, fqn);
    }
    String entityLinkValue = entityLink.getLinkString();
    List<TestCaseParameterValue> parameterValue =
        params.containsKey("parameterValues")
            ? JsonUtils.readOrConvertValues(
                params.get("parameterValues"), TestCaseParameterValue.class)
            : new ArrayList<>();

    String updatedBy = catalogSecurityContext.getUserPrincipal().getName();
    TestCase testCase =
        getTestCase(
            name, description, entityLinkValue, testDefinitionName, parameterValue, updatedBy);

    TestCaseRepository repository =
        (TestCaseRepository) Entity.getEntityRepository(Entity.TEST_CASE);
    repository.setFullyQualifiedName(testCase);
    repository.prepare(testCase, false);

    OperationContext operationContext =
        new OperationContext(Entity.TEST_CASE, MetadataOperation.CREATE);
    CreateResourceContext<TestCase> createResourceContext =
        new CreateResourceContext<>(Entity.TEST_CASE, testCase);
    limits.enforceLimits(catalogSecurityContext, createResourceContext, operationContext);
    authorizer.authorize(catalogSecurityContext, operationContext, createResourceContext);

    LOG.info(
        "Creating test case '{}' with definition '{}' for entity: {}",
        name,
        testDefinitionName,
        fqn);
    String impersonatedBy = ImpersonationContext.getImpersonatedBy();
    RestUtil.PutResponse<TestCase> response =
        repository.createOrUpdate(null, testCase, updatedBy, impersonatedBy);
    McpChangeEventUtil.publishChangeEvent(
        response.getEntity(), response.getChangeType(), updatedBy);
    return JsonUtils.getMap(response.getEntity());
  }
}
