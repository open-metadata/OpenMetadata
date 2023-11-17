package org.openmetadata.service.search.indexes;

import static org.openmetadata.service.search.EntityBuilderConstant.COLUMNS_NAME_KEYWORD;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.FlattenColumn;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.JsonUtils;

public class DashboardDataModelIndex implements ColumnIndex {

  private static final List<String> excludeFields = List.of("changeDescription");

  final DashboardDataModel dashboardDataModel;

  public DashboardDataModelIndex(DashboardDataModel dashboardDataModel) {
    this.dashboardDataModel = dashboardDataModel;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(dashboardDataModel);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    List<SearchSuggest> suggest = new ArrayList<>();
    List<SearchSuggest> columnSuggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(dashboardDataModel.getName()).weight(10).build());
    suggest.add(SearchSuggest.builder().input(dashboardDataModel.getFullyQualifiedName()).weight(5).build());
    Set<List<TagLabel>> tagsWithChildren = new HashSet<>();
    List<String> columnsWithChildrenName = new ArrayList<>();
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    if (dashboardDataModel.getColumns() != null) {
      List<FlattenColumn> cols = new ArrayList<>();
      parseColumns(dashboardDataModel.getColumns(), cols, null);
      for (FlattenColumn col : cols) {
        columnSuggest.add(SearchSuggest.builder().input(col.getName()).weight(5).build());
        columnsWithChildrenName.add(col.getName());
        if (col.getTags() != null) {
          tagsWithChildren.add(col.getTags());
        }
      }
      doc.put("columnNames", columnsWithChildrenName);
    }
    ParseTags parseTags = new ParseTags(Entity.getEntityTags(Entity.DASHBOARD_DATA_MODEL, dashboardDataModel));
    tagsWithChildren.add(parseTags.getTags());
    List<TagLabel> flattenedTagList =
        tagsWithChildren.stream().flatMap(List::stream).collect(ArrayList::new, ArrayList::add, ArrayList::addAll);
    doc.put("tags", flattenedTagList);
    doc.put("column_suggest", columnSuggest);
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.DASHBOARD_DATA_MODEL);
    doc.put(
        "fqnParts",
        getFQNParts(
            dashboardDataModel.getFullyQualifiedName(),
            suggest.stream().map(SearchSuggest::getInput).collect(Collectors.toList())));
    doc.put("tier", parseTags.getTierTag());
    doc.put("owner", getEntityWithDisplayName(dashboardDataModel.getOwner()));
    doc.put("service", getEntityWithDisplayName(dashboardDataModel.getService()));
    doc.put("domain", getEntityWithDisplayName(dashboardDataModel.getDomain()));
    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put(COLUMNS_NAME_KEYWORD, 10.0f);
    fields.put("columns.name", 2.0f);
    fields.put("columns.name.ngram", 1.0f);
    fields.put("columns.displayName", 1.0f);
    fields.put("columns.description", 1.0f);
    fields.put("columns.children.name", 2.0f);
    return fields;
  }
}
