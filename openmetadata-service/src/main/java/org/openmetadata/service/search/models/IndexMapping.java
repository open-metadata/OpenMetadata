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

  String indexName;
  String indexMappingFile;
  String alias;
  List<String> parentAliases;
}
