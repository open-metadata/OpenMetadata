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

package org.openmetadata.service.apps.bundles.dataRetention;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import java.util.stream.Stream;
import org.openmetadata.schema.governance.workflows.WorkflowInstance.WorkflowStatus;
import org.openmetadata.service.jdbi3.WorkflowDocStoreDAOs.WorkflowInstanceStateTimeSeriesDAO;
import org.openmetadata.service.jdbi3.WorkflowDocStoreDAOs.WorkflowInstanceTimeSeriesDAO;
import org.openmetadata.service.jdbi3.WorkflowDocStoreDAOs.WorkflowInstanceTimeSeriesDAO.ExpiredRun;
import org.openmetadata.service.jdbi3.WorkflowDocStoreDAOs.WorkflowInstanceTimeSeriesDAO.ExpiredRunPage;

/**
 * Deletes expired governance workflow runs, each together with all of its stage states, one keyset
 * page at a time.
 *
 * <p>The cursor only moves forward, so a pass reads every expired run once. Runs the pass must keep
 * (the latest run of each workflow per entity, and any run whose Flowable process is still alive)
 * are stepped over once instead of being rescanned on every page. The deletion rule is
 * ADR:2026-10-22-governance-workflow-runs-keep-each-entitys-latest-run.
 */
final class WorkflowRunRetention {

  // Every status but RUNNING; the query also requires that no Flowable process of the run is alive.
  private static final List<String> ENDED_STATUSES =
      Stream.of(
              WorkflowStatus.FINISHED,
              WorkflowStatus.FAILURE,
              WorkflowStatus.SUPERSEDED,
              WorkflowStatus.CANCELLED,
              WorkflowStatus.EXCEPTION)
          .map(WorkflowStatus::value)
          .toList();

  private final WorkflowInstanceTimeSeriesDAO runDAO;
  private final WorkflowInstanceStateTimeSeriesDAO stateDAO;

  private ExpiredRunPage page;
  private boolean drained = false;
  private int deletedStates = 0;

  WorkflowRunRetention(
      final WorkflowInstanceTimeSeriesDAO runDAO,
      final WorkflowInstanceStateTimeSeriesDAO stateDAO,
      final long cutoffTs,
      final int pageSize) {
    this.runDAO = runDAO;
    this.stateDAO = stateDAO;
    this.page = ExpiredRunPage.first(cutoffTs, pageSize);
  }

  /** Deletes the next page of expired runs with their states and returns how many runs went. */
  int deleteNextPage() {
    final List<ExpiredRun> runs = runDAO.listExpiredRuns(page, ENDED_STATUSES);
    drained = runs.size() < page.limit();
    int deletedRuns = 0;
    if (!nullOrEmpty(runs)) {
      page = page.after(runs.getLast());
      deletedRuns = deleteRunsWithStates(runs.stream().map(ExpiredRun::id).toList());
    }
    return deletedRuns;
  }

  private int deleteRunsWithStates(final List<String> runIds) {
    // States go first: a failure between the two deletes leaves a run with no states, which the
    // next pass still finds and deletes. The other order would strand states nothing looks for.
    deletedStates += stateDAO.deleteByWorkflowInstanceIds(runIds);
    return runDAO.deleteByIds(runIds);
  }

  boolean isDrained() {
    return drained;
  }

  int deletedStates() {
    return deletedStates;
  }
}
