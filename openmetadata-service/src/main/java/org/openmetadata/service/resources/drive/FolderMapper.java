package org.openmetadata.service.resources.drive;

import static org.openmetadata.service.util.EntityUtil.getEntityReference;

import org.openmetadata.schema.api.data.CreateFolder;
import org.openmetadata.schema.entity.data.Folder;
import org.openmetadata.service.jdbi3.FolderRepository;
import org.openmetadata.service.mapper.EntityMapper;

public class FolderMapper implements EntityMapper<Folder, CreateFolder> {
  @Override
  public Folder createToEntity(CreateFolder create, String user) {
    return copy(new Folder(), create, user)
        .withTags(create.getTags())
        .withIcon(create.getIcon())
        .withColor(create.getColor())
        .withParent(getEntityReference(FolderRepository.FOLDER_ENTITY, create.getParent()));
  }
}
