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

package org.openmetadata.service.formatter.entity;

import static org.openmetadata.service.formatter.util.FormatterUtil.transformMessage;

import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.dataInsight.type.KpiResult;
import org.openmetadata.schema.dataInsight.type.KpiTarget;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.service.formatter.decorators.MessageDecorator;
import org.openmetadata.service.formatter.util.FormatterUtil;

public class KpiFormatter implements EntityFormatter {
  private static final String KPI_RESULT_FIELD = "kpiResult";

  @Override
  public String format(
      MessageDecorator<?> messageFormatter,
      FieldChange fieldChange,
      EntityInterface entity,
      FormatterUtil.CHANGE_TYPE changeType) {
    if (KPI_RESULT_FIELD.equals(fieldChange.getName())) {
      return transformKpiResult(messageFormatter, fieldChange, entity);
    }
    return transformMessage(messageFormatter, fieldChange, entity, changeType);
  }

  private String transformKpiResult(
      MessageDecorator<?> messageFormatter, FieldChange fieldChange, EntityInterface entity) {
    String kpiName = entity.getName();
    KpiResult result = (KpiResult) fieldChange.getNewValue();
    if (result != null) {
      String format =
          String.format(
              "Added Results for %s. Target Name : %s , Current Value: %s, Target Met: %s",
              messageFormatter.getBold(),
              messageFormatter.getBold(),
              messageFormatter.getBold(),
              messageFormatter.getBold());
      KpiTarget target = result.getTargetResult().get(0);
      return String.format(
          format, kpiName, target.getName(), target.getValue(), target.getTargetMet());
    }
    String format = String.format("KpiResult %s is updated.", messageFormatter.getBold());
    return String.format(format, kpiName);
  }
}
