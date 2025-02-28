package org.openmetadata.service.search.models;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;
import lombok.Builder;
import lombok.Getter;
import lombok.extern.jackson.Jacksonized;

@JsonInclude(JsonInclude.Include.NON_NULL)
@Jacksonized
@Getter
@Builder
public class IndexMapping {
  @Getter String indexName;
  String indexMappingFile;
  String alias;
  List<String> parentAliases;
  List<String> childAliases;
  public static final String indexNameSeparator = "_";

  public String getIndexName(String clusterAlias) {
    return clusterAlias != null && !clusterAlias.isEmpty()
        ? clusterAlias + indexNameSeparator + indexName
        : indexName;
  }

  public String getAlias(String clusterAlias) {
    return clusterAlias != null && !clusterAlias.isEmpty()
        ? clusterAlias + indexNameSeparator + alias
        : alias;
  }

  public List<String> getParentAliases(String clusterAlias) {
    return clusterAlias != null && !clusterAlias.isEmpty()
        ? parentAliases.stream().map(alias -> clusterAlias + indexNameSeparator + alias).toList()
        : parentAliases;
  }

  public List<String> getChildAliases(String clusterAlias) {
    return clusterAlias != null && !clusterAlias.isEmpty()
        ? childAliases.stream().map(alias -> clusterAlias + indexNameSeparator + alias).toList()
        : childAliases;
  }

  private String getAlias() {
    return alias;
  }

  private List<String> getParentAliases() {
    return parentAliases;
  }
}
