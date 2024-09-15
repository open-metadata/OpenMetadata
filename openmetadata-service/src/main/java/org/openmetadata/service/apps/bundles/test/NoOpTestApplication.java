package org.openmetadata.service.apps.bundles.test;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;

@Slf4j
@SuppressWarnings("unused")
public class NoOpTestApplication extends AbstractNativeApplication {

  public NoOpTestApplication(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    super(collectionDAO, searchRepository);
  }

  @Override
  public void init(App app) {
    super.init(app);
    LOG.info("NoOpTestApplication is initialized");
  }
}
