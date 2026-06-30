package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
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
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DataProductRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.domains.DataProductMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.util.RestUtil;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CreateDataProductToolTest {

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
    DataProductRepository repo = mock(DataProductRepository.class);
    DataProduct dataProduct = new DataProduct();
    dataProduct.setId(UUID.randomUUID());
    dataProduct.setName("CustomerInsights");

    RestUtil.PutResponse<DataProduct> putResponse =
        new RestUtil.PutResponse<>(Response.Status.CREATED, dataProduct, EventType.ENTITY_CREATED);

    when(repo.createOrUpdate(isNull(), any(DataProduct.class), anyString(), any()))
        .thenReturn(putResponse);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedConstruction<DataProductMapper> mapperMock =
            mockConstruction(
                DataProductMapper.class,
                (mapper, context) ->
                    when(mapper.createToEntity(any(), anyString())).thenReturn(dataProduct))) {

      entityMock.when(() -> Entity.getEntityRepository(Entity.DATA_PRODUCT)).thenReturn(repo);
      entityMock
          .when(() -> Entity.getEntityReferenceByName(anyString(), anyString(), any()))
          .thenReturn(new EntityReference());

      Map<String, Object> params = new HashMap<>();
      params.put("name", "CustomerInsights");
      params.put("description", "Customer insights data product");
      params.put("domains", List.of("Finance"));

      CreateDataProductTool tool = new CreateDataProductTool();
      Map<String, Object> result = tool.execute(authorizer, limits, securityContext, params);

      assertNotNull(result);
      verify(repo).prepareInternal(any(DataProduct.class), eq(false));
    }
  }

  @Test
  void testEmptyDomainsThrows() {
    Map<String, Object> params = new HashMap<>();
    params.put("name", "CustomerInsights");
    params.put("description", "Customer insights data product");
    params.put("domains", List.of());

    CreateDataProductTool tool = new CreateDataProductTool();
    assertThrows(
        IllegalArgumentException.class,
        () -> tool.execute(authorizer, limits, securityContext, params));
  }
}
