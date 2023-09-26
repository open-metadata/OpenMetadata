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

public class DataInsightTotalAssetTemplate {
  private Double totalDataAssets;
  private Double percentChangeTotalAssets;
  private String completeMessage;

  private int numberOfDaysChange;

  public DataInsightTotalAssetTemplate(
      Double totalDataAssets, Double percentChangeTotalAssets, int numberOfDaysChange) {
    this.totalDataAssets = totalDataAssets;
    this.percentChangeTotalAssets = percentChangeTotalAssets;
    this.numberOfDaysChange = numberOfDaysChange;
    String color = "#BF0000";
    if (percentChangeTotalAssets > 0) {
      color = "#008510";
    }
    completeMessage =
        String.format(
            "In the past week, the Total Data Assets changed by a total of <span style=\"color: %s; font-weight: bold;\">%.2f%%</span>",
            color, percentChangeTotalAssets);
  }

  public Double getTotalDataAssets() {
    return totalDataAssets;
  }

  public void setTotalDataAssets(Double totalDataAssets) {
    this.totalDataAssets = totalDataAssets;
  }

  public Double getPercentChangeTotalAssets() {
    return percentChangeTotalAssets;
  }

  public void setPercentChangeTotalAssets(Double percentChangeTotalAssets) {
    this.percentChangeTotalAssets = percentChangeTotalAssets;
  }

  public String getCompleteMessage() {
    return completeMessage;
  }

  public void setCompleteMessage(String completeMessage) {
    this.completeMessage = completeMessage;
  }

  public int getNumberOfDaysChange() {
    return numberOfDaysChange;
  }

  public void setNumberOfDaysChange(int numberOfDaysChange) {
    this.numberOfDaysChange = numberOfDaysChange;
  }
}
