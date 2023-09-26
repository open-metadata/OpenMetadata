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

  private final Double percentCompleted;
  private boolean kpiAvailable;
  private Double percentChange;
  private String targetKpi;
  private String numberOfDaysLeft;
  private String completeMessage;
  private int numberOfDaysChange;
  private Map<String, Double> tierMap;

  public DataInsightDescriptionAndOwnerTemplate(
      MetricType metricType,
      KpiCriteria criteria,
      Double percentCompleted,
      String targetKpi,
      Double percentChange,
      boolean isKpiAvailable,
      String numberOfDaysLeft,
      int numberOfDaysChange,
      Map<String, Double> tierMap) {
    this.percentCompleted = percentCompleted;
    this.targetKpi = targetKpi;
    this.percentChange = percentChange;
    this.kpiAvailable = isKpiAvailable;
    this.numberOfDaysLeft = numberOfDaysLeft;
    this.tierMap = tierMap;
    this.numberOfDaysChange = numberOfDaysChange;
    String color = "#BF0000";
    if (percentChange > 0) {
      color = "#008510";
    }
    this.completeMessage =
        String.format(
            "The %s changed by <strong style=\"color: %s;\">%.2f%%</strong> per cent in the last week. %s",
            getMetricTypeMessage(metricType), color, percentChange, getKpiCriteriaMessage(metricType, criteria));
  }

  private String getMetricTypeMessage(MetricType metricType) {
    switch (metricType) {
      case DESCRIPTION:
        return "<strong>Completed Description</strong>";
      case OWNER:
        return "<strong>Assigned Ownership</strong>";
      case TIER:
        return "<strong>Assets Assigned with Tiers</strong>";
    }
    return "";
  }

  private String getKpiCriteriaMessage(MetricType metricType, KpiCriteria criteria) {
    if (metricType != MetricType.TIER) {
      if (kpiAvailable) {
        switch (criteria) {
          case MET:
            return "Great the Target Set for KPIs has been achieved. It's time to restructure your goals, set new KPIs and progress faster.";
          case IN_PROGRESS:
            return String.format(
                "To meet the KPIs you will need a minimum of %s per cent completed description in the next %s days.",
                targetKpi, numberOfDaysLeft);
          case NOT_MET:
            return "The Target set for KPIs was not met it’s time to restructure your goals and progress faster.";
        }
      }
      return "You have not set any KPIS yet, it’s time to restructure your goals, set KPIs and progress faster.";
    }
    return "";
  }

  public Double getPercentCompleted() {
    return percentCompleted;
  }

  public String getTargetKpi() {
    return targetKpi;
  }

  public void setTargetKpi(String targetKpi) {
    this.targetKpi = targetKpi;
  }

  public Double getPercentChange() {
    return percentChange;
  }

  public void setPercentChange(Double percentChange) {
    this.percentChange = percentChange;
  }

  public boolean isKpiAvailable() {
    return kpiAvailable;
  }

  public void setKpiAvailable(boolean kpiAvailable) {
    this.kpiAvailable = kpiAvailable;
  }

  public String getNumberOfDaysLeft() {
    return numberOfDaysLeft;
  }

  public void setNumberOfDaysLeft(String numberOfDaysLeft) {
    this.numberOfDaysLeft = numberOfDaysLeft;
  }

  public String getCompleteMessage() {
    return completeMessage;
  }

  public void setCompleteMessage(String completeMessage) {
    this.completeMessage = completeMessage;
  }

  public Map<String, Double> getTierMap() {
    return tierMap;
  }

  public void setTierMap(Map<String, Double> tierMap) {
    this.tierMap = tierMap;
  }

  public int getNumberOfDaysChange() {
    return numberOfDaysChange;
  }

  public void setNumberOfDaysChange(int numberOfDaysChange) {
    this.numberOfDaysChange = numberOfDaysChange;
  }
}
