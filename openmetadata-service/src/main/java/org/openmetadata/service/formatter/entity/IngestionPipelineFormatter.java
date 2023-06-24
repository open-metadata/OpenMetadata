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

import java.text.SimpleDateFormat;
import java.util.Date;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.service.formatter.decorators.MessageDecorator;
import org.openmetadata.service.formatter.util.FormatterUtil;

public class IngestionPipelineFormatter implements EntityFormatter {
  private static final String PIPELINE_STATUS_FIELD = "pipelineStatus";

  @Override
  public String format(
      MessageDecorator<?> messageFormatter,
      FieldChange fieldChange,
      EntityInterface entity,
      FormatterUtil.CHANGE_TYPE changeType) {
    if (PIPELINE_STATUS_FIELD.equals(fieldChange.getName())) {
      return transformPipelineStatus(messageFormatter, fieldChange, entity);
    }
    return transformMessage(messageFormatter, fieldChange, entity, changeType);
  }

  private String transformPipelineStatus(
      MessageDecorator<?> messageFormatter, FieldChange fieldChange, EntityInterface entity) {
    String ingestionPipelineName = entity.getName();
    PipelineStatus status = (PipelineStatus) fieldChange.getNewValue();
    if (status != null) {
      String date = new SimpleDateFormat("dd/MM/yyyy HH:mm:ss").format(new Date(status.getEndDate()));
      String format =
          String.format("Ingestion Pipeline %s %s at %s", messageFormatter.getBold(), messageFormatter.getBold(), date);
      return String.format(format, ingestionPipelineName, status.getPipelineState());
    }
    String format = String.format("Ingestion Pipeline %s is updated", messageFormatter.getBold());
    return String.format(format, ingestionPipelineName);
  }
}
