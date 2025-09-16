package org.openmetadata.service.resources.drives;

import static org.openmetadata.service.util.EntityUtil.getEntityReference;

import org.openmetadata.schema.api.data.CreateWorksheet;
import org.openmetadata.schema.entity.data.Worksheet;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;

public class WorksheetMapper implements EntityMapper<Worksheet, CreateWorksheet> {
  @Override
  public Worksheet createToEntity(CreateWorksheet create, String user) {
    return copy(new Worksheet(), create, user)
        .withService(getEntityReference(Entity.DRIVE_SERVICE, create.getService()))
        .withSpreadsheet(getEntityReference(Entity.SPREADSHEET, create.getSpreadsheet()))
        .withWorksheetId(create.getWorksheetId())
        .withIndex(create.getIndex())
        .withRowCount(create.getRowCount())
        .withColumnCount(create.getColumnCount())
        .withColumns(create.getColumns())
        .withIsHidden(create.getIsHidden())
        .withSourceUrl(create.getSourceUrl());
  }
}
