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

package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.createAndRunIngestionPipeline;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.workflows.WorkflowConfiguration;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.CreateAndRunIngestionPipelineTaskDefinition;
import org.openmetadata.schema.utils.JsonUtils;

class CreateAndRunIngestionPipelineTaskTest {

  @Test
  void rejectsNodeNameThatIsNotABareVariableReference() {
    // The node name lands in code position inside the generated condition expressions, so only a
    // variable-reference charset may pass.
    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                new CreateAndRunIngestionPipelineTask(
                    definition("a'z"), new WorkflowConfiguration()));
    assertTrue(exception.getMessage().contains("a'z"));
  }

  @Test
  void acceptsBareNodeName() {
    assertDoesNotThrow(
        () ->
            new CreateAndRunIngestionPipelineTask(
                definition("DeployIngestion"), new WorkflowConfiguration()));
  }

  private static CreateAndRunIngestionPipelineTaskDefinition definition(String name) {
    return JsonUtils.readValue(
        """
        {
          "type": "automatedTask",
          "subType": "createAndRunIngestionPipelineTask",
          "name": "%s",
          "inputNamespaceMap": {"relatedEntity": "global"},
          "config": {"pipelineType": "metadata", "waitForCompletion": false, "timeoutSeconds": 3600}
        }
        """
            .formatted(name),
        CreateAndRunIngestionPipelineTaskDefinition.class);
  }
}
