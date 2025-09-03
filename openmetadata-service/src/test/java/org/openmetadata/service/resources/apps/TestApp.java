package org.openmetadata.service.resources.apps;

import org.openmetadata.service.apps.AbstractGlobalNativeApplication;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;

public class TestApp extends AbstractGlobalNativeApplication {
  public TestApp(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    super(collectionDAO, searchRepository);
  }
}
