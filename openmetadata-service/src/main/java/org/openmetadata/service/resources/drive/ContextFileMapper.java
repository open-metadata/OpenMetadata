package org.openmetadata.service.resources.drive;

import static org.openmetadata.service.util.EntityUtil.getEntityReference;

import org.openmetadata.schema.api.data.CreateContextFile;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.type.Votes;
import org.openmetadata.service.jdbi3.FolderRepository;
import org.openmetadata.service.mapper.EntityMapper;

public class ContextFileMapper implements EntityMapper<ContextFile, CreateContextFile> {
  @Override
  public ContextFile createToEntity(CreateContextFile create, String user) {
    return copy(new ContextFile(), create, user)
        .withTags(create.getTags())
        .withVotes(new Votes().withUpVotes(0).withDownVotes(0))
        .withFileType(create.getFileType())
        .withFileSize(create.getFileSize())
        .withContentType(create.getContentType())
        .withFileExtension(create.getFileExtension())
        .withFolder(getEntityReference(FolderRepository.FOLDER_ENTITY, create.getFolder()))
        .withAssetId(create.getAssetId())
        .withProcessingStatus(create.getProcessingStatus())
        .withSourceType(create.getSourceType())
        .withSourceId(create.getSourceId())
        .withSourceUrl(create.getSourceUrl());
  }
}
