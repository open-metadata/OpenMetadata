package org.openmetadata.service.resources.storages;

import static org.openmetadata.service.util.EntityUtil.getEntityReference;

import org.openmetadata.schema.api.data.CreateContainer;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;

public class ContainerMapper implements EntityMapper<Container, CreateContainer> {
  @Override
  public Container createToEntity(CreateContainer create, String user) {
    return copy(new Container(), create, user)
        .withService(getEntityReference(Entity.STORAGE_SERVICE, create.getService()))
        .withParent(create.getParent())
        .withDataModel(create.getDataModel())
        .withPrefix(create.getPrefix())
        .withNumberOfObjects(create.getNumberOfObjects())
        .withSize(create.getSize())
        .withFullPath(create.getFullPath())
        .withFileFormats(create.getFileFormats())
        .withSourceUrl(create.getSourceUrl())
        .withSourceHash(create.getSourceHash());
  }
}
