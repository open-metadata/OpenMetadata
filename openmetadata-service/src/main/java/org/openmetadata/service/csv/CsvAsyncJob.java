/*
 *  Copyright 2026 Collate.
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

package org.openmetadata.service.csv;

import java.util.List;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class CsvAsyncJob {
  private String jobId;
  private Operation operation;
  private String entityType;
  private String targetFqn;
  private String createdBy;
  private Status status;
  private Integer progress;
  private Integer total;
  private Boolean dryRun;
  private Boolean recursive;
  private String result;
  private String error;
  private String message;
  private Boolean cancelRequested;
  private Long createdAt;
  private Long updatedAt;
  private Long completedAt;
  private List<CsvAsyncJobLog> logs;

  public enum Operation {
    IMPORT,
    EXPORT
  }

  public enum Status {
    QUEUED,
    RUNNING,
    CANCELLING,
    CANCELLED,
    COMPLETED,
    FAILED
  }
}
