package org.openmetadata.service.apps;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.Mockito.mock;

import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;

class AbstractNativeApplicationTest {

  @Test
  void tryStopOutsideQuartzReturnsFalseByDefault() {
    AbstractNativeApplication app =
        new AbstractNativeApplication(mock(CollectionDAO.class), mock(SearchRepository.class)) {};

    assertFalse(app.tryStopOutsideQuartz());
  }
}
