package org.openmetadata.service.apps.bundles.insights.search;

import java.util.List;
import java.util.Map;
import lombok.Getter;

@Getter
public class DataInsightsSearchConfiguration {
  private Map<String, List<String>> mappingFields;
}
