package org.openmetadata.service.search.indexes;

import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.services.DriveService;
import org.openmetadata.service.Entity;

public class DriveServiceIndex implements TaggableIndex, ServiceBackedIndex, LineageIndex {
  final Set<String> excludeDriveServiceFields =
      Set.of("connection", "changeDescription", "incrementalChangeDescription");
  final DriveService driveService;

  public DriveServiceIndex(DriveService driveService) {
    this.driveService = driveService;
  }

  @Override
  public Object getEntity() {
    return driveService;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.DRIVE_SERVICE;
  }

  @Override
  public Set<String> getExcludedFields() {
    return excludeDriveServiceFields;
  }

  @Override
  public Object getIndexServiceType() {
    return driveService.getServiceType();
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put("serviceType", 5.0f);
    return fields;
  }
}
