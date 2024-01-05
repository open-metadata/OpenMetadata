package org.openmetadata.service.search.indexes;

import static org.openmetadata.service.search.EntityBuilderConstant.DATA_MODEL_COLUMNS_NAME_KEYWORD;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.FlattenColumn;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.JsonUtils;

public record ContainerIndex(Container container) implements ColumnIndex {
  private static final List<String> excludeFields = List.of("changeDescription");

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(container);
    List<SearchSuggest> suggest = new ArrayList<>();
    List<SearchSuggest> columnSuggest = new ArrayList<>();
    List<SearchSuggest> serviceSuggest = new ArrayList<>();
    Set<List<TagLabel>> tagsWithChildren = new HashSet<>();
    List<String> columnsWithChildrenName = new ArrayList<>();
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    suggest.add(SearchSuggest.builder().input(container.getFullyQualifiedName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(container.getName()).weight(10).build());
    if (container.getDataModel() != null && container.getDataModel().getColumns() != null) {
      List<FlattenColumn> cols = new ArrayList<>();
      parseColumns(container.getDataModel().getColumns(), cols, null);

      for (FlattenColumn col : cols) {
        columnSuggest.add(SearchSuggest.builder().input(col.getName()).weight(5).build());
        columnsWithChildrenName.add(col.getName());
        if (col.getTags() != null) {
          tagsWithChildren.add(col.getTags());
        }
      }
      doc.put("columnNames", columnsWithChildrenName);
    }
    serviceSuggest.add(
        SearchSuggest.builder().input(container.getService().getName()).weight(5).build());
    ParseTags parseTags = new ParseTags(Entity.getEntityTags(Entity.CONTAINER, container));
    tagsWithChildren.add(parseTags.getTags());
    List<TagLabel> flattenedTagList =
        tagsWithChildren.stream()
            .flatMap(List::stream)
            .collect(ArrayList::new, ArrayList::add, ArrayList::addAll);

    doc.put(
        "displayName",
        container.getDisplayName() != null ? container.getDisplayName() : container.getName());
    doc.put("tags", flattenedTagList);
    doc.put("tier", parseTags.getTierTag());
    doc.put("followers", SearchIndexUtils.parseFollowers(container.getFollowers()));
    doc.put("suggest", suggest);
    doc.put("service_suggest", serviceSuggest);
    doc.put("column_suggest", columnSuggest);
    doc.put("entityType", Entity.CONTAINER);
    doc.put("serviceType", container.getServiceType());
    doc.put(
        "fqnParts",
        getFQNParts(
            container.getFullyQualifiedName(),
            suggest.stream().map(SearchSuggest::getInput).collect(Collectors.toList())));
    doc.put("owner", getEntityWithDisplayName(container.getOwner()));
    doc.put("service", getEntityWithDisplayName(container.getService()));
    doc.put("domain", getEntityWithDisplayName(container.getDomain()));
    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put("dataModel.columns.name", 2.0f);
    fields.put(DATA_MODEL_COLUMNS_NAME_KEYWORD, 10.0f);
    fields.put("dataModel.columns.name.ngram", 1.0f);
    fields.put("dataModel.columns.displayName", 2.0f);
    fields.put("dataModel.columns.displayName.ngram", 1.0f);
    fields.put("dataModel.columns.description", 1.0f);
    fields.put("dataModel.columns.children.name", 2.0f);
    return fields;
  }
}
