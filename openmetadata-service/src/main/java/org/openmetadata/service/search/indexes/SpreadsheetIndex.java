package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.data.Spreadsheet;
import org.openmetadata.service.Entity;

public class SpreadsheetIndex implements DataAssetIndex {
  final Set<String> excludeSpreadsheetFields =
      Set.of("worksheets", "changeDescription", "incrementalChangeDescription");
  final Spreadsheet spreadsheet;

  public SpreadsheetIndex(Spreadsheet spreadsheet) {
    this.spreadsheet = spreadsheet;
  }

  @Override
  public Object getEntity() {
    return spreadsheet;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.SPREADSHEET;
  }

  @Override
  public Set<String> getExcludedFields() {
    return excludeSpreadsheetFields;
  }

  @Override
  public Object getIndexServiceType() {
    return spreadsheet.getServiceType();
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    doc.put("directory", getEntityWithDisplayName(spreadsheet.getDirectory()));
    doc.put("mimeType", spreadsheet.getMimeType());
    doc.put("path", spreadsheet.getPath());
    doc.put("driveFileId", spreadsheet.getDriveFileId());
    doc.put("size", spreadsheet.getSize());
    doc.put("fileVersion", spreadsheet.getFileVersion());
    doc.put("createdTime", spreadsheet.getCreatedTime());
    doc.put("modifiedTime", spreadsheet.getModifiedTime());
    doc.put("lastModifiedBy", getEntityWithDisplayName(spreadsheet.getLastModifiedBy()));

    if (spreadsheet.getWorksheets() != null && !spreadsheet.getWorksheets().isEmpty()) {
      List<String> worksheetNames = new ArrayList<>();
      spreadsheet.getWorksheets().forEach(worksheet -> worksheetNames.add(worksheet.getName()));
      doc.put("worksheetNames", worksheetNames);
      doc.put("worksheetNamesFuzzy", String.join(" ", worksheetNames));
    }
    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put("path", 5.0f);
    fields.put("mimeType", 3.0f);
    fields.put("worksheetNames", 4.0f);
    return fields;
  }
}
