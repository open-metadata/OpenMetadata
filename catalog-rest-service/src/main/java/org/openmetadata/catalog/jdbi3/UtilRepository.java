package org.openmetadata.catalog.jdbi3;

import static org.openmetadata.catalog.Entity.DASHBOARD;
import static org.openmetadata.catalog.Entity.MLMODEL;
import static org.openmetadata.catalog.Entity.PIPELINE;
import static org.openmetadata.catalog.Entity.SERVICE;
import static org.openmetadata.catalog.Entity.TABLE;
import static org.openmetadata.catalog.Entity.TEAM;
import static org.openmetadata.catalog.Entity.TOPIC;
import static org.openmetadata.catalog.Entity.USER;

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

  public Object getIndividualEntityCount(String entity) {
    switch (entity) {
      case TABLE:
        return dao.getAggregatedEntitiesCount().getTableCount();
      case TOPIC:
        return dao.getAggregatedEntitiesCount().getTopicCount();
      case DASHBOARD:
        return dao.getAggregatedEntitiesCount().getDashboardCount();
      case PIPELINE:
        return dao.getAggregatedEntitiesCount().getPipelineCount();
      case MLMODEL:
        return dao.getAggregatedEntitiesCount().getMlmodelCount();
      case SERVICE:
        return dao.getAggregatedEntitiesCount().getServicesCount();
      case USER:
        return dao.getAggregatedEntitiesCount().getUserCount();
      case TEAM:
        return dao.getAggregatedEntitiesCount().getTeamCount();
      default:
        return "Invalid Entity";
    }
  }
}
