/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.events.scheduled.template;

import java.util.Map;
import lombok.Getter;
import lombok.Setter;

@Getter
@SuppressWarnings("unused")
public class DataInsightDescriptionAndOwnerTemplate {
  public enum MetricType {
    DESCRIPTION,
    OWNER,
    TIER
  }

  public enum KpiCriteria {
    MET,
    IN_PROGRESS,
    NOT_MET
  }

  @Setter private String totalAssets;
  private final String changeCount;
  private final String percentCompleted;
  @Setter private boolean kpiAvailable;
  private String percentChange;
  @Setter private String percentChangeMessage;
  @Setter private String targetKpi;
  @Setter private String numberOfDaysLeft;
  @Setter private String completeMessage;
  @Setter private int numberOfDaysChange;
  @Setter private Map<String, Double> tierMap;
  @Setter private Map<String, Integer> dateMap;

  public DataInsightDescriptionAndOwnerTemplate(
      MetricType metricType,
      KpiCriteria criteria,
      String totalAssets,
      Double percentCompleted,
      String targetKpi,
      int changeCount,
      Double percentChange,
      boolean isKpiAvailable,
      String numberOfDaysLeft,
      int numberOfDaysChange,
      Map<String, Double> tierMap,
      Map<String, Integer> dateMap) {
    this.percentCompleted = String.format("%.2f", percentCompleted);
    this.targetKpi = targetKpi;
    this.changeCount = String.valueOf(changeCount);
    this.percentChange = String.format("%.2f", percentChange);
    this.percentChangeMessage = getFormattedPercentChangeMessage(percentChange);
    this.totalAssets = totalAssets;
    this.kpiAvailable = isKpiAvailable;
    this.numberOfDaysLeft = numberOfDaysLeft;
    this.tierMap = tierMap;
    this.numberOfDaysChange = numberOfDaysChange;
    this.dateMap = dateMap;
    String color = "#BF0000";
    if (percentChange > 0) {
      color = "#008510";
    }

    this.completeMessage =
        String.format(
            "The %s changed by <strong style=\"color: %s;\">%s%%</strong> in the last week. %s",
            getMetricTypeMessage(metricType),
            color,
            this.percentChange,
            getKpiCriteriaMessage(metricType, criteria));
  }

  private String getMetricTypeMessage(MetricType metricType) {
    return switch (metricType) {
      case DESCRIPTION -> "<strong>Completed Description</strong>";
      case OWNER -> "<strong>Assigned Ownership</strong>";
      case TIER -> "<strong>Assets Assigned with Tiers</strong>";
    };
  }

  private String getKpiCriteriaMessage(MetricType metricType, KpiCriteria criteria) {
    if (metricType != MetricType.TIER) {
      if (kpiAvailable) {
        return switch (criteria) {
          case MET -> "Great the Target Set for KPIs has been achieved. It's time to restructure your goals, set new KPIs and progress faster.";
          case IN_PROGRESS -> String.format(
              "To meet the KPIs you will need a minimum of %s%% %s in the next %s days.",
              targetKpi, getMetricTypeMessage(metricType).toLowerCase(), numberOfDaysLeft);
          case NOT_MET -> "The Target set for KPIs was not met it’s time to restructure your goals and progress faster.";
        };
      }
      return "You have not set any KPIs yet, it’s time to restructure your goals, set KPIs and progress faster.";
    }
    return "";
  }

  public void setPercentChange(Double percentChange) {
    this.percentChange = String.format("%.2f", percentChange);
  }

  public static String getFormattedPercentChangeMessage(Double percent) {
    String symbol = "";
    String color = "#BF0000";
    if (percent > 0) {
      symbol = "+";
      color = "#008611";
    }

    // No need for "-" since String.format handles negatives
    return String.format(
        "<span style=\"color:%s ; font-weight: 600\">%s%.2f%%</span>", color, symbol, percent);
  }
}
