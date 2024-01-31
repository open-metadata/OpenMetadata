package org.openmetadata.service.apps.bundles.test;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;

@Slf4j
public class NoOpTestApplication extends AbstractNativeApplication {

  @Override
  public void init(App app, CollectionDAO dao, SearchRepository searchRepository) {
    super.init(app, dao, searchRepository);
    LOG.info("NoOpTestApplication is initialized");
  }
}
