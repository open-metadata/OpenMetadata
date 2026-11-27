/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.events.consumer;

import org.openmetadata.service.util.DIContainer;
import org.openmetadata.service.util.PerRequestContextCleaner;
import org.quartz.DisallowConcurrentExecution;
import org.quartz.Job;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;

/**
 * The job the alert scheduler stores for every alert, whatever consumer it names. The job class is
 * the runtime's own, so a stored job never names a consumer class, and moving or removing one never
 * leaves a job the scheduler cannot run.
 */
@DisallowConcurrentExecution
public final class ConsumerJob implements Job {
  private final DIContainer dependencies;

  public ConsumerJob(DIContainer dependencies) {
    this.dependencies = dependencies;
  }

  @Override
  public void execute(JobExecutionContext context) throws JobExecutionException {
    // Quartz worker threads are long lived, shared with every other scheduled job, and never pass
    // through the JAX-RS response filter. Per-request ThreadLocal caches left behind here would be
    // served to whatever runs next on this thread, indefinitely stale. Destinations on this thread
    // read entities (governance workflows resolve inherited reviewers here), so bracket the whole
    // tick: start clean, and leave clean however this exits.
    PerRequestContextCleaner.clear();
    try {
      AlertTick.run(dependencies, context);
    } finally {
      PerRequestContextCleaner.clear();
    }
  }
}
