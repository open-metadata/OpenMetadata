package org.openmetadata.catalog.jdbi3;

import org.openmetadata.catalog.util.EntitiesCount;
import org.openmetadata.catalog.util.ServicesCount;

public class UtilRepository {
  private final CollectionDAO.UtilDAO dao;

  public UtilRepository(CollectionDAO.UtilDAO dao) {
    this.dao = dao;
  }

  public EntitiesCount getAllEntitiesCount() {
    return dao.getAggregatedEntitiesCount();
  }

  public ServicesCount getAllServicesCount() {
    return dao.getAggregatedServicesCount();
  }
}
