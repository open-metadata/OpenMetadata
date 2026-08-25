package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TagRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.tags.TagMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.util.RestUtil;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CreateTagToolTest {

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
    TagRepository repo = mock(TagRepository.class);
    Tag tag = new Tag();
    tag.setId(UUID.randomUUID());
    tag.setName("Sensitive");

    RestUtil.PutResponse<Tag> putResponse =
        new RestUtil.PutResponse<>(Response.Status.CREATED, tag, EventType.ENTITY_CREATED);

    when(repo.createOrUpdate(isNull(), any(Tag.class), anyString(), any())).thenReturn(putResponse);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedConstruction<TagMapper> mapperMock =
            mockConstruction(
                TagMapper.class,
                (mapper, context) ->
                    when(mapper.createToEntity(any(), anyString())).thenReturn(tag))) {

      entityMock.when(() -> Entity.getEntityRepository(Entity.TAG)).thenReturn(repo);
      entityMock
          .when(() -> Entity.getEntityReferenceByName(anyString(), anyString(), any()))
          .thenReturn(new EntityReference());

      Map<String, Object> params = new HashMap<>();
      params.put("name", "Sensitive");
      params.put("description", "Sensitive data");
      params.put("classification", "PII");

      CreateTagTool tool = new CreateTagTool();
      Map<String, Object> result = tool.execute(authorizer, limits, securityContext, params);

      assertNotNull(result);
      verify(repo).prepareInternal(any(Tag.class), eq(false));
    }
  }

  @Test
  void testResolveClassificationFromParentAndClassification() {
    assertEquals("PII", CreateTagTool.resolveClassification("PII", "PII.Sensitive"));
  }

  @Test
  void testResolveClassificationDerivedFromParent() {
    assertEquals("PII", CreateTagTool.resolveClassification(null, "PII.Sensitive"));
  }

  @Test
  void testResolveClassificationMismatchThrows() {
    assertThrows(
        IllegalArgumentException.class,
        () -> CreateTagTool.resolveClassification("Tier", "PII.Sensitive"));
  }

  @Test
  void testResolveClassificationBothAbsentThrows() {
    assertThrows(
        IllegalArgumentException.class, () -> CreateTagTool.resolveClassification(null, null));
  }
}
