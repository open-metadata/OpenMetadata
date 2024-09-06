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

import static org.openmetadata.service.events.scheduled.template.DataInsightDescriptionAndOwnerTemplate.getFormattedPercentChangeMessage;

import java.util.Map;
import lombok.Getter;
import lombok.Setter;

@Getter
@SuppressWarnings("unused")
public class DataInsightTotalAssetTemplate {
  private String totalDataAssets;
  private final String changeInTotalAssets;
  private String percentChangeTotalAssets;
  @Setter private String percentChangeMessage;
  @Setter private String completeMessage;
  @Setter private int numberOfDaysChange;
  @Setter private Map<String, Integer> dateMap;

  public DataInsightTotalAssetTemplate(
      String totalDataAssets,
      int assetsAddedOrRemoved,
      Double percentChangeTotalAssets,
      int numberOfDaysChange,
      Map<String, Integer> dateMap) {
    this.totalDataAssets = totalDataAssets;
    this.changeInTotalAssets = String.valueOf(assetsAddedOrRemoved);
    this.percentChangeTotalAssets = String.format("%.2f", percentChangeTotalAssets);
    this.percentChangeMessage = getFormattedPercentChangeMessage(percentChangeTotalAssets);
    this.numberOfDaysChange = numberOfDaysChange;
    this.dateMap = dateMap;
    String color = "#BF0000";
    if (percentChangeTotalAssets > 0) {
      color = "#008510";
    }

    completeMessage =
        String.format(
            "In the past week, the Total Data Assets changed by <span style=\"color: %s; font-weight: bold;\">%s%%</span>.",
            color, this.percentChangeTotalAssets);
  }

  public void setTotalDataAssets(Double totalDataAssets) {
    this.totalDataAssets = String.format("%.2f", totalDataAssets);
  }

  public void setPercentChangeTotalAssets(Double percentChangeTotalAssets) {
    this.percentChangeTotalAssets = String.format("%.2f", percentChangeTotalAssets);
  }
}
