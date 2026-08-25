package org.openmetadata.service.apps.bundles.searchIndex.distributed;

import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.mock;

import java.lang.reflect.Constructor;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.CollectionDAO;

class DistributedJobNotifierFactoryTest {

  private final CollectionDAO collectionDAO = mock(CollectionDAO.class);

  @Test
  void createUsesPollingNotifier() {
    DistributedJobNotifier notifier =
        DistributedJobNotifierFactory.create(collectionDAO, "server-1");

    assertInstanceOf(PollingJobNotifier.class, notifier);
  }

  @Test
  void utilityConstructorIsAccessibleForCoverage() throws Exception {
    Constructor<DistributedJobNotifierFactory> constructor =
        DistributedJobNotifierFactory.class.getDeclaredConstructor();
    constructor.setAccessible(true);

    assertNotNull(constructor.newInstance());
  }
}
