package org.openmetadata.service.apps.scheduler;

import org.openmetadata.service.jdbi3.CollectionDAO;

public class OmAppJobListener extends AbstractOmAppJobListener {

  protected OmAppJobListener(CollectionDAO dao) {
    super(dao);
  }
}
