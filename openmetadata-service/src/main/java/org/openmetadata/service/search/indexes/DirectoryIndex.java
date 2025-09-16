package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.data.Directory;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;

public class DirectoryIndex implements SearchIndex {
  final Set<String> excludeDirectoryFields =
      Set.of("children", "changeDescription", "incrementalChangeDescription");
  final Directory directory;

  public DirectoryIndex(Directory directory) {
    this.directory = directory;
  }

  @Override
  public Object getEntity() {
    return directory;
  }

  @Override
  public Set<String> getExcludedFields() {
    return excludeDirectoryFields;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    ParseTags parseTags = new ParseTags(Entity.getEntityTags(Entity.DIRECTORY, directory));
    List<TagLabel> tags = new ArrayList<>();
    tags.addAll(parseTags.getTags());

    Map<String, Object> commonAttributes = getCommonAttributesMap(directory, Entity.DIRECTORY);
    doc.putAll(commonAttributes);
    doc.put("tags", tags);
    doc.put("tier", parseTags.getTierTag());
    doc.put("serviceType", directory.getServiceType());
    doc.put("service", getEntityWithDisplayName(directory.getService()));
    doc.put("parent", getEntityWithDisplayName(directory.getParent()));
    doc.put("directoryType", directory.getDirectoryType());
    doc.put("path", directory.getPath());
    doc.put("isShared", directory.getIsShared());
    doc.put("numberOfFiles", directory.getNumberOfFiles());
    doc.put("numberOfSubDirectories", directory.getNumberOfSubDirectories());
    doc.put("totalSize", directory.getTotalSize());
    doc.put("upstreamLineage", SearchIndex.getLineageData(directory.getEntityReference()));
    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put("path", 5.0f);
    fields.put("directoryType", 3.0f);
    return fields;
  }
}
