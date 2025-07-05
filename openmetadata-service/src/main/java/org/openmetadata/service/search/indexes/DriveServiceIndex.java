package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.services.DriveService;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;

public class DriveServiceIndex implements SearchIndex {
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
  public Set<String> getExcludedFields() {
    return excludeDriveServiceFields;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    ParseTags parseTags = new ParseTags(Entity.getEntityTags(Entity.DRIVE_SERVICE, driveService));
    List<TagLabel> tags = new ArrayList<>();
    tags.addAll(parseTags.getTags());

    Map<String, Object> commonAttributes =
        getCommonAttributesMap(driveService, Entity.DRIVE_SERVICE);
    doc.putAll(commonAttributes);
    doc.put("tags", tags);
    doc.put("tier", parseTags.getTierTag());
    doc.put("serviceType", driveService.getServiceType());
    doc.put("entityType", Entity.DRIVE_SERVICE);

    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put("serviceType", 5.0f);
    return fields;
  }
}
