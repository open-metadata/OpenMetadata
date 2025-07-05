package org.openmetadata.service.resources.drives;

import static org.openmetadata.service.util.EntityUtil.getEntityReference;

import org.openmetadata.schema.api.data.CreateFile;
import org.openmetadata.schema.entity.data.File;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;

public class FileMapper implements EntityMapper<File, CreateFile> {
  @Override
  public File createToEntity(CreateFile create, String user) {
    return copy(new File(), create, user)
        .withService(getEntityReference(Entity.DRIVE_SERVICE, create.getService()))
        .withDirectory(getEntityReference(Entity.DIRECTORY, create.getDirectory()))
        .withFileType(create.getFileType())
        .withMimeType(create.getMimeType())
        .withExtension(create.getExtension())
        .withPath(create.getPath())
        .withDriveFileId(create.getDriveFileId())
        .withSize(create.getSize())
        .withChecksum(create.getChecksum())
        .withWebViewLink(create.getWebViewLink())
        .withDownloadLink(create.getDownloadLink())
        .withIsShared(create.getIsShared())
        .withFileVersion(create.getFileVersion())
        .withSourceUrl(create.getSourceUrl());
  }
}
