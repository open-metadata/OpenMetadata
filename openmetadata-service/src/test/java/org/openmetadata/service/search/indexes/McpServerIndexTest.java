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
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.entity.ai.McpServerType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;

class McpServerIndexTest {

  @Test
  void testBuildSearchIndexDocInternal() {
    UUID id = UUID.randomUUID();
    McpServer server =
        new McpServer()
            .withId(id)
            .withName("test-server")
            .withFullyQualifiedName("test-server")
            .withServerType(McpServerType.Database)
            .withDeleted(false);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityTags(anyString(), any(McpServer.class)))
          .thenReturn(Collections.emptyList());

      CollectionDAO dao = mock(CollectionDAO.class);
      CollectionDAO.EntityRelationshipDAO relationshipDAO =
          mock(CollectionDAO.EntityRelationshipDAO.class);
      when(dao.relationshipDAO()).thenReturn(relationshipDAO);
      when(relationshipDAO.findFrom(any(UUID.class), anyString(), anyInt()))
          .thenReturn(Collections.emptyList());
      entityMock.when(Entity::getCollectionDAO).thenReturn(dao);

      McpServerIndex index = new McpServerIndex(server);
      Map<String, Object> doc = new HashMap<>();
      Map<String, Object> result = index.buildSearchIndexDocInternal(doc);

      assertNotNull(result.get("tags"));
      assertEquals("test-server", result.get("displayName"));
      assertEquals(Entity.MCP_SERVER, result.get("entityType"));
    }
  }

  @Test
  void testGetEntityReturnsServer() {
    McpServer server = new McpServer().withId(UUID.randomUUID()).withName("s1");
    McpServerIndex index = new McpServerIndex(server);
    assertEquals(server, index.getEntity());
  }
}
