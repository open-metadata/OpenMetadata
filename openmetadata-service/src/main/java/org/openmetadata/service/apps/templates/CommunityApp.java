package org.openmetadata.service.apps.templates;

import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;

public class CommunityApp extends AbstractNativeApplication {
  public CommunityApp(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    super(collectionDAO, searchRepository);
  }
}
