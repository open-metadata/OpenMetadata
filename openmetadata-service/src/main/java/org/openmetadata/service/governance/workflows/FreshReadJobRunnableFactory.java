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

package org.openmetadata.service.governance.workflows;

import org.flowable.job.api.JobInfo;
import org.flowable.job.service.JobServiceConfiguration;
import org.flowable.job.service.impl.asyncexecutor.ExecuteAsyncRunnable;
import org.flowable.job.service.impl.asyncexecutor.ExecuteAsyncRunnableFactory;
import org.flowable.job.service.impl.asyncexecutor.JobExecutionObservationProvider;
import org.openmetadata.service.util.FreshReadScope;

/**
 * Runs every Flowable async job inside a {@link FreshReadScope}.
 *
 * <p>Workflow gates (has reviewers, is the editor a reviewer, is the entity ready for review) must
 * read the entity from the database, not from an in-process cache another node may not have
 * invalidated. Signal deliveries and task resolutions enter the scope on the calling thread, but
 * event-triggered workflows run their body on the async executor, whose pooled threads never pass
 * through either entry point. Wrapping the job runnable puts the whole job — every delegate up to
 * the next wait state — in one scope.
 *
 * <p>The wrapped runnable is the one Flowable builds by default: no extra exception handler (the job
 * service's own handlers still apply) and no observation provider.
 */
public final class FreshReadJobRunnableFactory implements ExecuteAsyncRunnableFactory {

  @Override
  public Runnable createExecuteAsyncRunnable(
      JobInfo job, JobServiceConfiguration jobServiceConfiguration) {
    Runnable jobRunnable =
        new ExecuteAsyncRunnable(
            job,
            jobServiceConfiguration,
            jobServiceConfiguration.getJobEntityManager(),
            null,
            JobExecutionObservationProvider.NOOP);
    return inFreshReadScope(jobRunnable);
  }

  static Runnable inFreshReadScope(Runnable jobRunnable) {
    return () -> {
      try (FreshReadScope.Handle ignored = FreshReadScope.enter()) {
        jobRunnable.run();
      }
    };
  }
}
