package org.openmetadata.service.resources.drives;

import static org.openmetadata.service.util.EntityUtil.getEntityReference;

import org.openmetadata.schema.api.data.CreateSpreadsheet;
import org.openmetadata.schema.entity.data.Spreadsheet;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;
import org.openmetadata.service.mapper.Mapper;

@Mapper(entityType = Entity.SPREADSHEET)
public class SpreadsheetMapper implements EntityMapper<Spreadsheet, CreateSpreadsheet> {
  @Override
  public Spreadsheet createToEntity(CreateSpreadsheet create, String user) {
    Spreadsheet spreadsheet =
        copy(new Spreadsheet(), create, user)
            .withService(getEntityReference(Entity.DRIVE_SERVICE, create.getService()))
            .withMimeType(create.getMimeType())
            .withPath(create.getPath())
            .withDriveFileId(create.getDriveFileId())
            .withSize(create.getSize())
            .withFileVersion(create.getFileVersion())
            .withSourceUrl(create.getSourceUrl())
            .withCreatedTime(create.getCreatedTime())
            .withModifiedTime(create.getModifiedTime());

    // Set directory from parent if provided
    if (create.getParent() != null) {
      // Parent is expected to be a directory reference
      spreadsheet.withDirectory(create.getParent());
    }

    return spreadsheet;
  }
}
