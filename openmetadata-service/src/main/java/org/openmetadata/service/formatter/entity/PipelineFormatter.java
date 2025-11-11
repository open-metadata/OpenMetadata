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
import org.openmetadata.schema.entity.data.PipelineStatus;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.formatter.decorators.MessageDecorator;
import org.openmetadata.service.formatter.util.FormatterUtil;

public class PipelineFormatter implements EntityFormatter {
  private static final String PIPELINE_STATUS_FIELD = "pipelineStatus";

  @Override
  public String format(
      MessageDecorator<?> messageFormatter,
      Thread thread,
      FieldChange fieldChange,
      FormatterUtil.CHANGE_TYPE changeType) {
    if (PIPELINE_STATUS_FIELD.equals(fieldChange.getName())) {
      return transformPipelineStatus(messageFormatter, thread, fieldChange);
    }
    return transformMessage(messageFormatter, thread, fieldChange, changeType);
  }

  private String transformPipelineStatus(
      MessageDecorator<?> messageFormatter, Thread thread, FieldChange fieldChange) {
    EntityInterface entity =
        Entity.getEntity(
            thread.getEntityRef().getType(), thread.getEntityRef().getId(), "id", Include.ALL);
    String pipelineName = entity.getName();
    PipelineStatus status =
        JsonUtils.readOrConvertValue(fieldChange.getNewValue(), PipelineStatus.class);
    if (status != null) {
      String date =
          new SimpleDateFormat("dd/MM/yyyy HH:mm:ss").format(new Date(status.getTimestamp()));
      String format =
          String.format(
              "Pipeline %s %s at %s", messageFormatter.getBold(), messageFormatter.getBold(), date);
      return String.format(format, pipelineName, status.getExecutionStatus());
    }
    String format = String.format("Pipeline %s is updated", messageFormatter.getBold());
    return String.format(format, pipelineName);
  }
}
