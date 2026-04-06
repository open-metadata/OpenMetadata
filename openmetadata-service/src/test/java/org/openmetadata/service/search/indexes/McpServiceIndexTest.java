package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.services.CreateMcpService;
import org.openmetadata.schema.entity.services.McpService;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;

class McpServiceIndexTest {

  private void stubSearchRepository(MockedStatic<Entity> entityMock) {
    SearchRepository searchRepo = mock(SearchRepository.class);
    when(searchRepo.getSearchClient())
        .thenReturn(mock(org.openmetadata.service.search.SearchClient.class));
    entityMock.when(Entity::getSearchRepository).thenReturn(searchRepo);
  }

  @Test
  void testGetEntityReturnsService() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      stubSearchRepository(entityMock);

      McpService service =
          new McpService()
              .withId(UUID.randomUUID())
              .withName("test-service")
              .withFullyQualifiedName("test-service")
              .withServiceType(CreateMcpService.McpServiceType.Mcp)
              .withDeleted(false);

      McpServiceIndex index = new McpServiceIndex(service);
      assertEquals(service, index.getEntity());
    }
  }

  @Test
  void testBuildSearchIndexDocInternal() {
    UUID id = UUID.randomUUID();
    McpService service =
        new McpService()
            .withId(id)
            .withName("my-service")
            .withFullyQualifiedName("my-service")
            .withServiceType(CreateMcpService.McpServiceType.Mcp)
            .withDeleted(false);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      stubSearchRepository(entityMock);
      entityMock
          .when(() -> Entity.getEntityTags(anyString(), any(McpService.class)))
          .thenReturn(Collections.emptyList());

      CollectionDAO dao = mock(CollectionDAO.class);
      CollectionDAO.EntityRelationshipDAO relationshipDAO =
          mock(CollectionDAO.EntityRelationshipDAO.class);
      when(dao.relationshipDAO()).thenReturn(relationshipDAO);
      when(relationshipDAO.findFrom(any(UUID.class), anyString(), anyInt()))
          .thenReturn(Collections.emptyList());
      entityMock.when(Entity::getCollectionDAO).thenReturn(dao);

      McpServiceIndex index = new McpServiceIndex(service);
      Map<String, Object> doc = new HashMap<>();
      Map<String, Object> result = index.buildSearchIndexDocInternal(doc);

      assertNotNull(result);
      assertEquals(Entity.MCP_SERVICE, result.get("entityType"));
      assertEquals("my-service", result.get("displayName"));
    }
  }
}
