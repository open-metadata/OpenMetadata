package org.openmetadata.service.apps.bundles.test;

import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.service.apps.AbstractGlobalNativeApplication;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;

@Slf4j
@SuppressWarnings("unused")
public class NoOpTestApplication extends AbstractGlobalNativeApplication {

  public NoOpTestApplication(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    super(collectionDAO, searchRepository);
  }

  @Override
  public void init(App app) {
    super.init(app);
    LOG.info("NoOpTestApplication is initialized");
  }

  @Override
  public void triggerForService(UUID serviceId, Map<String, Object> config) {
    // This is a NoOp application - no service-specific logic
    LOG.debug("NoOp triggerForService called for service: {}", serviceId);
  }
}
