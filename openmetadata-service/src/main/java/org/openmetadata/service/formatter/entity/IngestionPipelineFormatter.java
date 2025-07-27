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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.formatter.util.FormatterUtil.transformMessage;

import java.text.SimpleDateFormat;
import java.util.Date;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.formatter.decorators.MessageDecorator;
import org.openmetadata.service.formatter.util.FormatterUtil;

public class IngestionPipelineFormatter implements EntityFormatter {
  private static final String PIPELINE_STATUS_FIELD = "pipelineStatus";

  @Override
  public String format(
      MessageDecorator<?> messageFormatter,
      Thread thread,
      FieldChange fieldChange,
      FormatterUtil.CHANGE_TYPE changeType) {
    if (PIPELINE_STATUS_FIELD.equals(fieldChange.getName())) {
      return transformIngestionPipelineStatus(messageFormatter, thread, fieldChange);
    }
    return transformMessage(messageFormatter, thread, fieldChange, changeType);
  }

  private String transformIngestionPipelineStatus(
      MessageDecorator<?> messageFormatter, Thread thread, FieldChange fieldChange) {
    EntityInterface entity =
        Entity.getEntity(
            thread.getEntityRef().getType(), thread.getEntityRef().getId(), "id", Include.ALL);
    String ingestionPipelineName = entity.getName();
    PipelineStatus status =
        JsonUtils.readOrConvertValue(fieldChange.getNewValue(), PipelineStatus.class);
    if (status != null) {
      // In case of running
      String date =
          new SimpleDateFormat("dd/MM/yyyy HH:mm:ss").format(new Date(status.getTimestamp()));
      String format =
          String.format(
              "Ingestion Pipeline %s %s at %s",
              messageFormatter.getBold(), messageFormatter.getBold(), date);
      return String.format(format, ingestionPipelineName, status.getPipelineState());
    }
    String format = String.format("Ingestion Pipeline %s is updated", messageFormatter.getBold());
    return String.format(format, ingestionPipelineName);
  }

  public static String getIngestionPipelineUrl(
      MessageDecorator<?> formatter, String entityType, EntityInterface entityInterface) {
    if (entityType.equals(Entity.INGESTION_PIPELINE)) {
      // Tags need to be redirected to Classification Page
      IngestionPipeline ingestionPipeline = (IngestionPipeline) entityInterface;
      EntityReference serviceRef = ingestionPipeline.getService();
      if (nullOrEmpty(serviceRef)) {
        serviceRef =
            ((IngestionPipeline)
                    Entity.getEntity(
                        ingestionPipeline.getEntityReference(), "service", Include.ALL))
                .getService();
      }
      // Specific Pipeline
      if (ingestionPipeline.getPipelineType().equals(PipelineType.TEST_SUITE)) {
        String suffix = ".testSuite";
        return !nullOrEmpty(serviceRef)
            ? formatter.getEntityUrl(
                "table",
                serviceRef
                    .getFullyQualifiedName()
                    .substring(0, serviceRef.getFullyQualifiedName().length() - suffix.length()),
                "profiler?activeTab=Data%20Quality")
            : "";
      } else if (ingestionPipeline.getPipelineType().equals(PipelineType.APPLICATION)) {
        return !nullOrEmpty(serviceRef)
            ? formatter.getEntityUrl(
                "automations", serviceRef.getFullyQualifiedName(), "automator-details")
            : "";
      } else {
        return !nullOrEmpty(serviceRef)
            ? formatter.getEntityUrl(
                String.format("service/%ss", serviceRef.getType()),
                serviceRef.getFullyQualifiedName(),
                "ingestions")
            : "";
      }
    }
    return "";
  }
}
