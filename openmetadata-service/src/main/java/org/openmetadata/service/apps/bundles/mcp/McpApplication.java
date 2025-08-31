package org.openmetadata.service.apps.bundles.mcp;

import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.apps.AbstractGlobalNativeApplication;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;

@Slf4j
public class McpApplication extends AbstractGlobalNativeApplication {
  public McpApplication(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    super(collectionDAO, searchRepository);
  }

  @Override
  public void triggerForService(UUID serviceId, Map<String, Object> config) {
    LOG.debug("MCP Application triggerForService called for service: {}", serviceId);
    // Implementation for MCP service-specific logic
  }
}
