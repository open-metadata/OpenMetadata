package org.openmetadata.service.jdbi3;

import org.openmetadata.schema.entity.app.AppMarketPlaceDefinition;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.apps.AppMarketPlaceResource;
import org.openmetadata.service.util.EntityUtil;

public class AppMarketPlaceRepository extends EntityRepository<AppMarketPlaceDefinition> {

  public AppMarketPlaceRepository() {
    super(
        AppMarketPlaceResource.COLLECTION_PATH,
        Entity.APP_MARKET_PLACE_DEF,
        AppMarketPlaceDefinition.class,
        Entity.getCollectionDAO().applicationMarketPlaceDAO(),
        "",
        "");
    supportsSearch = false;
    quoteFqn = true;
  }

  @Override
  public AppMarketPlaceDefinition setFields(AppMarketPlaceDefinition entity, EntityUtil.Fields fields) {
    return entity;
  }

  @Override
  public AppMarketPlaceDefinition clearFields(AppMarketPlaceDefinition entity, EntityUtil.Fields fields) {
    return entity;
  }

  @Override
  public void prepare(AppMarketPlaceDefinition entity, boolean update) {}

  @Override
  public void storeEntity(AppMarketPlaceDefinition entity, boolean update) {
    store(entity, update);
  }

  @Override
  public void storeRelationships(AppMarketPlaceDefinition entity) {}
}
