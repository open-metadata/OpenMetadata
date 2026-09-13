package org.openmetadata.service.jdbi3;

import java.util.Set;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppMarketPlaceDefinition;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.resources.apps.AppMarketPlaceResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

@Repository()
public class AppMarketPlaceRepository implements EntityPolicy<AppMarketPlaceDefinition> {

  public AppMarketPlaceRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                AppMarketPlaceResource.COLLECTION_PATH,
                Entity.APP_MARKET_PLACE_DEF,
                AppMarketPlaceDefinition.class,
                Entity.getCollectionDAO().applicationMarketPlaceDAO()),
            new EntityPolicyContext.WriteFields("", "", Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
    context().options().setSupportsSearch(false);
    context().options().setQuoteFqn(true);
  }

  @Override
  public void setFields(
      AppMarketPlaceDefinition entity,
      EntityUtil.Fields fields,
      RelationIncludes relationIncludes) {
    /* Nothing to do */
  }

  public AppMarketPlaceDefinition getDefinition(App app) {
    return lookup().byName(app.getName(), Include.NON_DELETED);
  }

  @Override
  public void clearFields(AppMarketPlaceDefinition entity, EntityUtil.Fields fields) {
    /* Nothing to do */
  }

  @Override
  public void prepare(AppMarketPlaceDefinition entity, boolean update) {}

  @Override
  public void storeEntity(AppMarketPlaceDefinition entity, boolean update) {
    persistence().store(entity, update);
  }

  @Override
  public void storeRelationships(AppMarketPlaceDefinition entity) {}

  private final EntityPolicyContext<AppMarketPlaceDefinition> entityContext;

  @Override
  public final EntityPolicyContext<AppMarketPlaceDefinition> context() {
    return entityContext;
  }
}
