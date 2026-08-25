package org.openmetadata.service.resources.mlmodels;

import static org.openmetadata.service.util.EntityUtil.getEntityReference;

import org.openmetadata.schema.api.data.CreateMlModel;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;

public class MlModelMapper implements EntityMapper<MlModel, CreateMlModel> {
  @Override
  public MlModel createToEntity(CreateMlModel create, String user) {
    return copy(new MlModel(), create, user)
        .withService(getEntityReference(Entity.MLMODEL_SERVICE, create.getService()))
        .withDashboard(getEntityReference(Entity.DASHBOARD, create.getDashboard()))
        .withAlgorithm(create.getAlgorithm())
        .withMlFeatures(create.getMlFeatures())
        .withMlHyperParameters(create.getMlHyperParameters())
        .withMlStore(create.getMlStore())
        .withServer(create.getServer())
        .withTarget(create.getTarget())
        .withSourceUrl(create.getSourceUrl())
        .withSourceHash(create.getSourceHash());
  }
}
