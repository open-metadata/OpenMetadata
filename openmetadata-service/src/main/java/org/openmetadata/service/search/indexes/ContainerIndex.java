package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.FlattenColumn;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.JsonUtils;

public class ContainerIndex implements ColumnIndex {
  private static final List<String> excludeFields = List.of("changeDescription");

  final Container container;

  public ContainerIndex(Container container) {
    this.container = container;
  }

  public Map<String, Object> buildESDoc() {
    if (container.getOwner() != null) {
      EntityReference owner = container.getOwner();
      owner.setDisplayName(CommonUtil.nullOrEmpty(owner.getDisplayName()) ? owner.getName() : owner.getDisplayName());
      container.setOwner(owner);
    }
    Map<String, Object> doc = JsonUtils.getMap(container);
    List<SearchSuggest> suggest = new ArrayList<>();
    List<SearchSuggest> columnSuggest = new ArrayList<>();
    List<SearchSuggest> serviceSuggest = new ArrayList<>();
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    suggest.add(SearchSuggest.builder().input(container.getFullyQualifiedName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(container.getName()).weight(10).build());
    if (container.getDataModel() != null && container.getDataModel().getColumns() != null) {
      List<FlattenColumn> cols = new ArrayList<>();
      parseColumns(container.getDataModel().getColumns(), cols, null);

      for (FlattenColumn col : cols) {
        columnSuggest.add(SearchSuggest.builder().input(col.getName()).weight(5).build());
      }
    }
    serviceSuggest.add(SearchSuggest.builder().input(container.getService().getName()).weight(5).build());
    ParseTags parseTags = new ParseTags(Entity.getEntityTags(Entity.CONTAINER, container));

    doc.put("displayName", container.getDisplayName() != null ? container.getDisplayName() : container.getName());
    doc.put("tags", parseTags.getTags());
    doc.put("tier", parseTags.getTierTag());
    doc.put("followers", SearchIndexUtils.parseFollowers(container.getFollowers()));
    doc.put("suggest", suggest);
    doc.put("service_suggest", serviceSuggest);
    doc.put("column_suggest", columnSuggest);
    doc.put("entityType", Entity.CONTAINER);
    doc.put("serviceType", container.getServiceType());
    return doc;
  }
}
