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

package org.openmetadata.service.clients.pipeline.config;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.metadataIngestion.OpenMetadataAppConfig;
import org.openmetadata.schema.metadataIngestion.OpenMetadataWorkflowConfig;
import org.openmetadata.service.clients.pipeline.config.types.WorkflowBuildException;

public class YAMLUtils {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper(new YAMLFactory());

  /*
  Ref https://stackoverflow.com/questions/33409893/converting-java-class-structure-to-yml-file
   */
  public static String stringifiedOMWorkflowConfig(OpenMetadataWorkflowConfig workflowConfig)
      throws WorkflowBuildException {
    try {
      return OBJECT_MAPPER.writeValueAsString(workflowConfig);
    } catch (JsonProcessingException exc) {
      throw new WorkflowBuildException(
          String.format(
              "JSON Processing error converting OpenMetadataWorkflowConfig to string due to [%s]",
              exc.getMessage()));
    }
  }

  public static String stringifiedOMAppConfig(OpenMetadataAppConfig applicationConfig)
      throws WorkflowBuildException {
    try {
      return OBJECT_MAPPER.writeValueAsString(applicationConfig);
    } catch (JsonProcessingException exc) {
      throw new WorkflowBuildException(
          String.format(
              "JSON Processing error converting OpenMetadataApplicationConfig to string due to [%s]",
              exc.getMessage()));
    }
  }

  public static String stringifiedAutomationWorkflow(Workflow automationWorkflow)
      throws WorkflowBuildException {
    try {
      return OBJECT_MAPPER.writeValueAsString(automationWorkflow);
    } catch (JsonProcessingException exc) {
      throw new WorkflowBuildException(
          String.format(
              "JSON Processing error converting Automation Workflow to string due to [%s]",
              exc.getMessage()));
    }
  }

  public static <T> T readValue(String content, Class<T> valueType) throws JsonProcessingException {
    return OBJECT_MAPPER.readValue(content, valueType);
  }
}
