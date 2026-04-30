package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;

import java.lang.reflect.Field;
import java.util.Arrays;
import java.util.HashSet;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.services.McpService;
import org.openmetadata.service.Entity;

class McpServiceRepositoryTest {

  @Test
  void testConstructorSetsSupportsSearch() throws Exception {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      CollectionDAO dao = mock(CollectionDAO.class);
      CollectionDAO.McpServiceDAO mcpServiceDAO = mock(CollectionDAO.McpServiceDAO.class);
      entityMock.when(Entity::getCollectionDAO).thenReturn(dao);
      entityMock
          .when(() -> Entity.getEntityClassFromType(Entity.MCP_SERVICE))
          .thenReturn(McpService.class);
      entityMock
          .when(() -> Entity.registerResourcePermissions(Entity.MCP_SERVICE, null))
          .thenAnswer(inv -> null);
      entityMock
          .when(() -> Entity.registerResourceFieldViewMapping(Entity.MCP_SERVICE, null))
          .thenAnswer(inv -> null);
      entityMock
          .when(() -> Entity.getEntityFields(McpService.class))
          .thenReturn(
              new HashSet<>(
                  Arrays.asList(
                      "id",
                      "name",
                      "fullyQualifiedName",
                      "serviceType",
                      "description",
                      "displayName",
                      "version",
                      "updatedAt",
                      "updatedBy",
                      "pipelines",
                      "connection",
                      "testConnectionResult",
                      "tags",
                      "owners",
                      "href",
                      "changeDescription",
                      "incrementalChangeDescription",
                      "deleted",
                      "dataProducts",
                      "followers",
                      "domains",
                      "ingestionRunner")));
      org.mockito.Mockito.when(dao.mcpServiceDAO()).thenReturn(mcpServiceDAO);

      McpServiceRepository repo = new McpServiceRepository();

      Field supportsSearchField = EntityRepository.class.getDeclaredField("supportsSearch");
      supportsSearchField.setAccessible(true);
      assertTrue((boolean) supportsSearchField.get(repo));
    }
  }
}
