package org.openmetadata.service.apps.bundles.mcp;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;

@Slf4j
public class McpApplication extends AbstractNativeApplication {
  public McpApplication(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    super(collectionDAO, searchRepository);
  }
}
