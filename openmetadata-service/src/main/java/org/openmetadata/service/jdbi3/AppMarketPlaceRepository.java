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

  @Override
  public EntityUpdater getUpdater(
      AppMarketPlaceDefinition original, AppMarketPlaceDefinition updated, Operation operation) {
    return new AppMarketPlaceRepository.AppMarketPlaceUpdater(original, updated, operation);
  }

  public class AppMarketPlaceUpdater extends EntityUpdater {
    public AppMarketPlaceUpdater(
        AppMarketPlaceDefinition original, AppMarketPlaceDefinition updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() {
      recordChange("features", original.getFeatures(), updated.getFeatures());
      recordChange("developer", original.getDeveloper(), updated.getDeveloper());
      recordChange("developerUrl", original.getDeveloperUrl(), updated.getDeveloperUrl());
      recordChange("privacyPolicyUrl", original.getPrivacyPolicyUrl(), updated.getPrivacyPolicyUrl());
      recordChange("supportEmail", original.getSupportEmail(), updated.getSupportEmail());
      recordChange("className", original.getClassName(), updated.getClassName());
      recordChange("permission", original.getPermission(), updated.getPermission());
      recordChange("appScreenshots", original.getAppScreenshots(), updated.getAppScreenshots());
      recordChange("runtime", original.getRuntime(), updated.getRuntime());
      recordChange("appConfiguration", original.getAppConfiguration(), updated.getAppConfiguration());
      recordChange("appConfigSchema", original.getAppConfigSchema(), updated.getAppConfigSchema());
      recordChange("appLogoUrl", original.getAppLogoUrl(), updated.getAppLogoUrl());
      recordChange("appScreenshots", original.getAppScreenshots(), updated.getAppScreenshots());
    }
  }
}
