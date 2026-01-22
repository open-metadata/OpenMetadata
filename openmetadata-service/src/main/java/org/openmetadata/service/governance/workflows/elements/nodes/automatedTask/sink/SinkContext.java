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

package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.sink;

import java.util.Map;
import lombok.Builder;
import lombok.Data;

/**
 * Context object passed to sink providers containing configuration and metadata for sink
 * operations.
 */
@Data
@Builder
public class SinkContext {

  /** The sink-specific configuration object. */
  private Object sinkConfig;

  /** The sync mode: "append", "overwrite", or "merge". */
  private String syncMode;

  /** The output format: "yaml" or "json". */
  private String outputFormat;

  /** Hierarchy configuration for maintaining asset structure. */
  private Object hierarchyConfig;

  /** Entity filter configuration for selecting specific entities. */
  private Object entityFilter;

  /** Whether batch mode is enabled. */
  private boolean batchMode;

  /** Timeout in seconds for sink operations. */
  private int timeoutSeconds;

  /** Additional context data from the workflow execution. */
  private Map<String, Object> additionalContext;

  /** The workflow execution instance ID for audit purposes. */
  private String workflowExecutionId;

  /** The name of the workflow that triggered this sink operation. */
  private String workflowName;
}
