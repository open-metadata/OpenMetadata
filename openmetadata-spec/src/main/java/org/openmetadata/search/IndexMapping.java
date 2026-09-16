package org.openmetadata.search;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import lombok.Builder;
import lombok.Getter;
import lombok.extern.jackson.Jacksonized;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@JsonInclude(JsonInclude.Include.NON_NULL)
@Jacksonized
@Getter
@Builder
public class IndexMapping {
  private static final Logger LOG = LoggerFactory.getLogger(IndexMapping.class);
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  @Getter String indexName;
  String indexMappingFile;
  String alias;
  List<String> parentAliases;
  List<String> childAliases;
  List<String> dataInsightAliases;
  public static final String INDEX_NAME_SEPARATOR = "_";

  /**
   * Data Insights joins its index and alias names with '-', not INDEX_NAME_SEPARATOR. The chart
   * aggregators query the wildcard {@code <clusterAlias>-di-data-assets-*}, so an alias prefixed
   * with '_' would never be matched.
   */
  private static final String DATA_INSIGHT_NAME_SEPARATOR = "-";

  private static final String DATA_ASSET_ALIAS = "dataAsset";

  public String getIndexName(String clusterAlias) {
    return clusterAlias != null && !clusterAlias.isEmpty()
        ? clusterAlias + INDEX_NAME_SEPARATOR + indexName
        : indexName;
  }

  public String getAlias(String clusterAlias) {
    return clusterAlias != null && !clusterAlias.isEmpty()
        ? clusterAlias + INDEX_NAME_SEPARATOR + alias
        : alias;
  }

  public List<String> getParentAliases(String clusterAlias) {
    return clusterAlias != null && !clusterAlias.isEmpty()
        ? parentAliases.stream().map(a -> clusterAlias + INDEX_NAME_SEPARATOR + a).toList()
        : parentAliases;
  }

  public List<String> getDataInsightAliases(String clusterAlias) {
    List<String> aliases = dataInsightAliases == null ? List.of() : dataInsightAliases;
    return clusterAlias != null && !clusterAlias.isEmpty()
        ? aliases.stream().map(a -> clusterAlias + DATA_INSIGHT_NAME_SEPARATOR + a).toList()
        : aliases;
  }

  public List<String> getChildAliases(String clusterAlias) {
    return clusterAlias != null && !clusterAlias.isEmpty()
        ? childAliases.stream().map(a -> clusterAlias + INDEX_NAME_SEPARATOR + a).toList()
        : childAliases;
  }

  public String getIndexMappingFile(String language) {
    return String.format(indexMappingFile, language).replaceFirst("^/", "");
  }
}
