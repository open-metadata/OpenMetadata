package org.openmetadata.service.resources.drives;

import static org.openmetadata.service.util.EntityUtil.getEntityReference;

import org.openmetadata.schema.api.data.CreateDirectory;
import org.openmetadata.schema.entity.data.Directory;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;

public class DirectoryMapper implements EntityMapper<Directory, CreateDirectory> {
  @Override
  public Directory createToEntity(CreateDirectory create, String user) {
    return copy(new Directory(), create, user)
        .withService(getEntityReference(Entity.DRIVE_SERVICE, create.getService()))
        .withParent(
            create.getParent() != null
                ? getEntityReference(Entity.DIRECTORY, create.getParent())
                : null)
        .withPath(create.getPath())
        .withDriveId(create.getDriveId())
        .withIsShared(create.getIsShared())
        .withSourceUrl(create.getSourceUrl());
  }
}
