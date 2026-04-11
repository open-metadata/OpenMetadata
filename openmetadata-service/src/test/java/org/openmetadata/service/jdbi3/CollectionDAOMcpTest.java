package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.entity.services.McpService;

class CollectionDAOMcpTest {

  @Test
  void testMcpServerDAODefaultMethods() {
    CollectionDAO.McpServerDAO dao = mock(CollectionDAO.McpServerDAO.class, CALLS_REAL_METHODS);

    assertEquals("mcp_server_entity", dao.getTableName());
    assertEquals(McpServer.class, dao.getEntityClass());
    assertEquals("fqnHash", dao.getNameHashColumn());
  }

  @Test
  void testMcpExecutionDAODefaultMethods() {
    CollectionDAO.McpExecutionDAO dao =
        mock(CollectionDAO.McpExecutionDAO.class, CALLS_REAL_METHODS);

    assertEquals("mcp_execution_entity", dao.getTimeSeriesTableName());
    assertEquals("serverId", dao.getPartitionFieldName());
  }

  @Test
  void testMcpServiceDAODefaultMethods() {
    CollectionDAO.McpServiceDAO dao = mock(CollectionDAO.McpServiceDAO.class, CALLS_REAL_METHODS);

    assertEquals("mcp_service_entity", dao.getTableName());
    assertEquals(McpService.class, dao.getEntityClass());
    assertEquals("nameHash", dao.getNameHashColumn());
  }
}
