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

package org.openmetadata.service.apps.bundles.searchIndex.distributed;

import java.util.UUID;
import org.openmetadata.service.apps.bundles.searchIndex.ReindexingJobContext;

/**
 * Implementation of ReindexingJobContext for distributed indexing jobs. Wraps a SearchIndexJob to
 * provide context information to progress listeners.
 */
public class DistributedJobContext implements ReindexingJobContext {

  private final SearchIndexJob job;
  private final String source;

  public DistributedJobContext(SearchIndexJob job) {
    this(job, "DISTRIBUTED");
  }

  public DistributedJobContext(SearchIndexJob job, String source) {
    this.job = job;
    this.source = source;
  }

  @Override
  public UUID getJobId() {
    return job.getId();
  }

  @Override
  public String getJobName() {
    return "DistributedSearchIndex-" + job.getId().toString().substring(0, 8);
  }

  @Override
  public Long getStartTime() {
    return job.getStartedAt() != null ? job.getStartedAt() : job.getCreatedAt();
  }

  @Override
  public UUID getAppId() {
    return job.getId();
  }

  @Override
  public boolean isDistributed() {
    return true;
  }

  @Override
  public String getSource() {
    return source;
  }

  public SearchIndexJob getJob() {
    return job;
  }
}
