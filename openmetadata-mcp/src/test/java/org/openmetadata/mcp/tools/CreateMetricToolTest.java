package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.Response;
import java.security.Principal;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.MetricRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.metrics.MetricMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.util.RestUtil;

@ExtendWith(MockitoExtension.class)
class CreateMetricToolTest {

  private Authorizer authorizer;
  private Limits limits;
  private CatalogSecurityContext securityContext;

  @BeforeEach
  void setUp() {
    authorizer = mock(Authorizer.class);
    limits = mock(Limits.class);
    securityContext = mock(CatalogSecurityContext.class);

    Principal mockPrincipal = mock(Principal.class);
    when(mockPrincipal.getName()).thenReturn("test-user");
    when(securityContext.getUserPrincipal()).thenReturn(mockPrincipal);
  }

  @Test
  void testExecuteCallsPrepareInternal() {
    MetricRepository repo = mock(MetricRepository.class);
    Metric metric = new Metric();
    metric.setId(UUID.randomUUID());
    metric.setName("TestMetric");

    RestUtil.PutResponse<Metric> putResponse =
        new RestUtil.PutResponse<>(Response.Status.CREATED, metric, EventType.ENTITY_CREATED);

    when(repo.createOrUpdate(isNull(), any(Metric.class), anyString(), any()))
        .thenReturn(putResponse);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedConstruction<MetricMapper> mapperMock =
            mockConstruction(
                MetricMapper.class,
                (mapper, context) ->
                    when(mapper.createToEntity(any(), anyString())).thenReturn(metric))) {

      entityMock.when(() -> Entity.getEntityRepository(Entity.METRIC)).thenReturn(repo);

      Map<String, Object> params = new HashMap<>();
      params.put("name", "TestMetric");
      params.put("metricExpressionLanguage", "SQL");
      params.put("metricExpressionCode", "SELECT COUNT(*) FROM orders");

      CreateMetricTool tool = new CreateMetricTool();
      Map<String, Object> result = tool.execute(authorizer, limits, securityContext, params);

      assertNotNull(result);
      verify(repo).prepareInternal(any(Metric.class), eq(false));
    }
  }
}
