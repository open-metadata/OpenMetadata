package org.openmetadata.mcp.tools;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.Response;
import java.security.Principal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TestCaseRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.dqtests.TestCaseMapper;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.util.RestUtil;

@ExtendWith(MockitoExtension.class)
class CreateTestCaseToolTest {

  private Authorizer authorizer;
  private Limits limits;
  private CatalogSecurityContext securityContext;

  @BeforeEach
  void setUp() {
    authorizer = mock(Authorizer.class);
    limits = mock(Limits.class);
    securityContext = mock(CatalogSecurityContext.class);
  }

  @Test
  void testNonLimitsOverloadThrows() {
    CreateTestCaseTool tool = new CreateTestCaseTool();
    Map<String, Object> params = new HashMap<>();
    assertThatThrownBy(() -> tool.execute(authorizer, securityContext, params))
        .isInstanceOf(UnsupportedOperationException.class);
  }

  @Test
  void testLimitsAwareExecuteCreatesTestCase() {
    Principal mockPrincipal = mock(Principal.class);
    when(mockPrincipal.getName()).thenReturn("test-user");
    when(securityContext.getUserPrincipal()).thenReturn(mockPrincipal);

    TestCaseRepository repo = mock(TestCaseRepository.class);
    TestCase testCase = new TestCase();
    testCase.setId(UUID.randomUUID());
    testCase.setName("TestCase_1");

    RestUtil.PutResponse<TestCase> putResponse =
        new RestUtil.PutResponse<>(Response.Status.CREATED, testCase, EventType.ENTITY_CREATED);

    when(repo.createOrUpdate(isNull(), any(TestCase.class), anyString(), any()))
        .thenReturn(putResponse);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<McpChangeEventUtil> eventMock = mockStatic(McpChangeEventUtil.class);
        MockedConstruction<TestCaseMapper> mapperMock =
            mockConstruction(
                TestCaseMapper.class,
                (mapper, context) ->
                    when(mapper.createToEntity(any(), anyString())).thenReturn(testCase))) {

      entityMock.when(() -> Entity.getEntityRepository(Entity.TEST_CASE)).thenReturn(repo);

      Map<String, Object> params = new HashMap<>();
      params.put("testDefinitionName", "tableRowCountToEqual");
      params.put("fqn", "sample_data.ecommerce_db.shopify.orders");
      params.put("name", "TestCase_1");
      params.put("parameterValues", new ArrayList<>());

      CreateTestCaseTool tool = new CreateTestCaseTool();
      Map<String, Object> result = tool.execute(authorizer, limits, securityContext, params);

      assertThat(result).isNotNull();
      verify(repo).setFullyQualifiedName(any(TestCase.class));
      verify(repo).prepare(any(TestCase.class), any(Boolean.class));
      verify(limits).enforceLimits(any(), any(), any());
      verify(authorizer).authorize(any(), any(), any());
    }
  }

  @Test
  void authorizationRunsBeforePrepareSoADeniedCallerLeavesNoTestSuite() {
    // TestCaseRepository.prepare resolves the basic test suite and persists one as the ingestion
    // bot when it is missing. Running it before authorize meant a caller who was then denied had
    // already written a test suite into the catalog. TestCaseResource authorizes first.
    Principal mockPrincipal = mock(Principal.class);
    when(mockPrincipal.getName()).thenReturn("test-user");
    when(securityContext.getUserPrincipal()).thenReturn(mockPrincipal);

    TestCaseRepository repo = mock(TestCaseRepository.class);
    TestCase testCase = new TestCase();
    testCase.setId(UUID.randomUUID());
    testCase.setName("TestCase_1");
    when(repo.createOrUpdate(isNull(), any(TestCase.class), anyString(), any()))
        .thenReturn(
            new RestUtil.PutResponse<>(
                Response.Status.CREATED, testCase, EventType.ENTITY_CREATED));

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<McpChangeEventUtil> eventMock = mockStatic(McpChangeEventUtil.class);
        MockedConstruction<TestCaseMapper> mapperMock =
            mockConstruction(
                TestCaseMapper.class,
                (mapper, context) ->
                    when(mapper.createToEntity(any(), anyString())).thenReturn(testCase))) {

      entityMock.when(() -> Entity.getEntityRepository(Entity.TEST_CASE)).thenReturn(repo);

      Map<String, Object> params = new HashMap<>();
      params.put("testDefinitionName", "tableRowCountToEqual");
      params.put("fqn", "sample_data.ecommerce_db.shopify.orders");
      params.put("name", "TestCase_1");
      params.put("parameterValues", new ArrayList<>());

      new CreateTestCaseTool().execute(authorizer, limits, securityContext, params);

      InOrder ordered = inOrder(authorizer, repo);
      ordered.verify(authorizer).authorize(any(), any(), any());
      ordered.verify(repo).prepare(any(TestCase.class), any(Boolean.class));
    }
  }

  @Test
  void aDeniedOverwriteWritesNoTestSuite() {
    // prepare() resolves the basic test suite and persists one as the ingestion bot when missing.
    // The overwrite (EDIT_ALL) check therefore has to run BEFORE prepare, or a caller denied on the
    // overwrite has already left catalog state behind — the same write-on-denial this tool closed
    // for the CREATE leg. Asserting the persistence boundary, not just call order.
    Principal mockPrincipal = mock(Principal.class);
    when(mockPrincipal.getName()).thenReturn("test-user");
    when(securityContext.getUserPrincipal()).thenReturn(mockPrincipal);

    TestCaseRepository repo = mock(TestCaseRepository.class);
    TestCase testCase = new TestCase();
    testCase.setId(UUID.randomUUID());
    testCase.setName("TestCase_1");
    testCase.setFullyQualifiedName("svc.db.sch.tbl.TestCase_1");

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<CommonUtils> commonUtils =
            mockStatic(CommonUtils.class, org.mockito.Mockito.CALLS_REAL_METHODS);
        MockedConstruction<TestCaseMapper> mapperMock =
            mockConstruction(
                TestCaseMapper.class,
                (mapper, context) ->
                    when(mapper.createToEntity(any(), anyString())).thenReturn(testCase))) {

      entityMock.when(() -> Entity.getEntityRepository(Entity.TEST_CASE)).thenReturn(repo);
      // Simulate the overwrite check denying the caller.
      commonUtils
          .when(
              () ->
                  CommonUtils.authorizeOverwrite(
                      any(), any(), org.mockito.ArgumentMatchers.eq(Entity.TEST_CASE), any()))
          .thenThrow(new AuthorizationException("EDIT_ALL not allowed"));

      Map<String, Object> params = new HashMap<>();
      params.put("testDefinitionName", "tableRowCountToEqual");
      params.put("fqn", "sample_data.ecommerce_db.shopify.orders");
      params.put("name", "TestCase_1");
      params.put("parameterValues", new ArrayList<>());

      CreateTestCaseTool tool = new CreateTestCaseTool();
      assertThatThrownBy(() -> tool.execute(authorizer, limits, securityContext, params))
          .isInstanceOf(AuthorizationException.class);

      // Nothing may have been prepared or written once the overwrite check rejected the call.
      verify(repo, never()).prepare(any(TestCase.class), any(Boolean.class));
      verify(repo, never()).createOrUpdate(isNull(), any(TestCase.class), anyString(), any());
    }
  }
}
