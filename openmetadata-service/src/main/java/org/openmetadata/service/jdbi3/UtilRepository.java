package org.openmetadata.service.jdbi3;

import org.openmetadata.schema.util.EntitiesCount;
import org.openmetadata.schema.util.ServicesCount;

public class UtilRepository {
  private final CollectionDAO.UtilDAO dao;

  public UtilRepository(CollectionDAO.UtilDAO dao) {
    this.dao = dao;
  }

  public EntitiesCount getAllEntitiesCount(ListFilter filter) {
    return dao.getAggregatedEntitiesCount(filter.getCondition());
  }

  public ServicesCount getAllServicesCount(ListFilter filter) {
    return dao.getAggregatedServicesCount(filter.getCondition());
  }
}
