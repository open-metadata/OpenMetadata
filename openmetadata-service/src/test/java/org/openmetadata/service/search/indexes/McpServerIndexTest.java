package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Collections;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.entity.ai.McpServerType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;

class McpServerIndexTest {

  private static MockedStatic<Entity> entityStaticMock;

  @BeforeAll
  static void setUp() {
    SearchRepository mockSearchRepo = mock(SearchRepository.class, Mockito.RETURNS_DEEP_STUBS);
    SearchClient mockSearchClient = mock(SearchClient.class);
    when(mockSearchRepo.getSearchClient()).thenReturn(mockSearchClient);
    entityStaticMock = Mockito.mockStatic(Entity.class);
    entityStaticMock.when(Entity::getSearchRepository).thenReturn(mockSearchRepo);
  }

  @AfterAll
  static void tearDown() {
    entityStaticMock.close();
  }

  @Test
  void testBuildSearchIndexDoc_producesCommonAndMixinFields() {
    UUID id = UUID.randomUUID();
    McpServer server =
        new McpServer()
            .withId(id)
            .withName("test-server")
            .withFullyQualifiedName("test-server")
            .withServerType(McpServerType.Database)
            .withDeleted(false);

    entityStaticMock
        .when(() -> Entity.getEntityTags(anyString(), any(McpServer.class)))
        .thenReturn(Collections.emptyList());

    CollectionDAO dao = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    when(dao.relationshipDAO()).thenReturn(relationshipDAO);
    when(relationshipDAO.findFrom(any(UUID.class), anyString(), anyInt()))
        .thenReturn(Collections.emptyList());
    entityStaticMock.when(Entity::getCollectionDAO).thenReturn(dao);

    McpServerIndex index = new McpServerIndex(server);
    Map<String, Object> result = index.buildSearchIndexDoc();

    // Common fields (populated by template method)
    assertEquals("test-server", result.get("displayName"));
    assertEquals(Entity.MCP_SERVER, result.get("entityType"));

    // TaggableIndex fields
    assertNotNull(result.get("tags"));
    assertTrue(result.containsKey("classificationTags"));
    assertTrue(result.containsKey("glossaryTags"));

    // LineageIndex fields
    assertTrue(result.containsKey("upstreamLineage"));
  }

  @Test
  void testBuildSearchIndexDocInternal_returnsEmptyDoc() {
    McpServer server =
        new McpServer().withId(UUID.randomUUID()).withName("s").withFullyQualifiedName("s");

    McpServerIndex index = new McpServerIndex(server);
    Map<String, Object> doc = new java.util.HashMap<>();
    Map<String, Object> result = index.buildSearchIndexDocInternal(doc);

    // buildSearchIndexDocInternal now has no entity-specific fields for McpServer
    assertTrue(result.isEmpty());
  }

  @Test
  void testGetEntityReturnsServer() {
    McpServer server = new McpServer().withId(UUID.randomUUID()).withName("s1");
    McpServerIndex index = new McpServerIndex(server);
    assertEquals(server, index.getEntity());
  }
}
