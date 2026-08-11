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

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.Accessors;

@Getter
@Setter
@NoArgsConstructor
@Accessors(chain = true)
public class CsvAsyncJobArgs {
  private CsvAsyncJob.Operation operation;
  private String entityType;
  private String targetFqn;
  private Boolean dryRun;
  private Boolean recursive;
  private String csv;
  private String versioningEntityType;
  // Present when the job exports search results instead of a single entity
  // tree; the handler streams matching documents straight into the spool file.
  private SearchExportArgs searchExport;

  @Getter
  @Setter
  @NoArgsConstructor
  @Accessors(chain = true)
  public static class SearchExportArgs {
    private String query;
    private String index;
    private Boolean deleted;
    private String queryFilter;
    private String postFilter;
    private String sortField;
    private String sortOrder;
    private Integer size;
    private Integer from;
  }
}
