package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.secrets.masker.PasswordEntityMasker.PASSWORD_MASK;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.ai.Env;
import org.openmetadata.schema.entity.ai.McpConnectionConfig;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.entity.ai.McpServerType;
import org.openmetadata.schema.utils.JsonUtils;
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
            .withConnectionConfig(
                new McpConnectionConfig()
                    .withCommand("npx")
                    .withArgs(List.of("--token=argument-secret"))
                    .withEnv(new Env().withAdditionalProperty("DATABASE_PASSWORD", "env-secret"))
                    .withUrl("https://mcp.example.com/?api_key=url-secret"))
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

    final McpServer original = JsonUtils.deepCopy(server, McpServer.class);
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

    final McpConnectionConfig indexedConfig =
        JsonUtils.convertValue(result.get("connectionConfig"), McpConnectionConfig.class);
    assertEquals("npx", indexedConfig.getCommand());
    assertEquals(List.of(PASSWORD_MASK), indexedConfig.getArgs());
    assertEquals(
        PASSWORD_MASK, indexedConfig.getEnv().getAdditionalProperties().get("DATABASE_PASSWORD"));
    assertEquals(PASSWORD_MASK, indexedConfig.getUrl());
    assertEquals(original, server, "Indexing must not modify the entity being stored");
  }

  @Test
  void testBuildSearchIndexDocInternal_projectsAiGovernanceFields() {
    McpServer server =
        new McpServer()
            .withId(UUID.randomUUID())
            .withName("s")
            .withFullyQualifiedName("s")
            .withServerType(McpServerType.Database);

    McpServerIndex index = new McpServerIndex(server);
    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = index.buildSearchIndexDocInternal(doc);

    Object projection = result.get("aiGovernance");
    assertInstanceOf(Map.class, projection);
    assertEquals("Database", ((Map<?, ?>) projection).get("assetSubtype"));
  }

  @Test
  void testGetEntityReturnsServer() {
    McpServer server = new McpServer().withId(UUID.randomUUID()).withName("s1");
    McpServerIndex index = new McpServerIndex(server);
    assertEquals(server, index.getEntity());
  }
}
