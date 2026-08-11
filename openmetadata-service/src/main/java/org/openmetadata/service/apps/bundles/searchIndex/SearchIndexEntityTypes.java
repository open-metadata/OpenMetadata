/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.apps.bundles.searchIndex;

import static org.openmetadata.service.Entity.QUERY_COST_RECORD;
import static org.openmetadata.service.Entity.TEST_CASE_RESOLUTION_STATUS;
import static org.openmetadata.service.Entity.TEST_CASE_RESULT;

import java.util.LinkedHashSet;
import java.util.Set;
import org.openmetadata.schema.analytics.ReportData;

public final class SearchIndexEntityTypes {
  public static final String ALL = "all";
  public static final String QUERY_COST_RESULT = "queryCostResult";

  public static final Set<String> TIME_SERIES_ENTITIES =
      Set.of(
          ReportData.ReportDataType.ENTITY_REPORT_DATA.value(),
          ReportData.ReportDataType.RAW_COST_ANALYSIS_REPORT_DATA.value(),
          ReportData.ReportDataType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA.value(),
          ReportData.ReportDataType.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA.value(),
          ReportData.ReportDataType.AGGREGATED_COST_ANALYSIS_REPORT_DATA.value(),
          TEST_CASE_RESOLUTION_STATUS,
          TEST_CASE_RESULT,
          QUERY_COST_RECORD);

  private SearchIndexEntityTypes() {}

  public static String normalizeEntityType(String entityType) {
    return QUERY_COST_RESULT.equals(entityType) ? QUERY_COST_RECORD : entityType;
  }

  public static Set<String> normalizeEntityTypes(Set<String> entityTypes) {
    if (entityTypes == null || entityTypes.isEmpty()) {
      return entityTypes;
    }
    Set<String> normalizedEntityTypes = new LinkedHashSet<>();
    for (String entityType : entityTypes) {
      normalizedEntityTypes.add(normalizeEntityType(entityType));
    }
    return normalizedEntityTypes;
  }

  public static boolean isTimeSeriesEntity(String entityType) {
    return TIME_SERIES_ENTITIES.contains(normalizeEntityType(entityType));
  }

  public static boolean isDataInsightEntity(String entityType) {
    return entityType != null && entityType.endsWith("ReportData");
  }
}
