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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { OntologyBulkJob } from '../../../generated/api/data/ontologyBulkJob';
import { usePollingEffect } from '../../../hooks/usePollingEffect';
import {
  cancelOntologyBulkJob,
  listOntologyBulkJobs,
} from '../../../rest/ontologyAPI';
import { isActiveOntologyBulkJob } from '../OntologyBulkAuthoring.utils';

interface UseOntologyBulkJobsResult {
  cancelJob: (jobId: number) => Promise<void>;
  hasLoadError: boolean;
  isCancelling: boolean;
  isLoading: boolean;
  jobs: OntologyBulkJob[];
  noteBackgroundSubmission: (jobId?: number) => void;
  refreshJobs: () => Promise<void>;
}

// Sentinel used when the caller knows a background job was submitted but does
// not have its numeric id. Real ids are positive auto-increment values, so -1
// will never collide with an actual job row.
const PENDING_WITHOUT_ID = -1;
const PENDING_SUBMISSION_TIMEOUT_MS = 60_000;
const JOB_LIST_LIMIT = 100;

export const useOntologyBulkJobs = (
  glossaryId: string | undefined
): UseOntologyBulkJobsResult => {
  const [jobs, setJobs] = useState<OntologyBulkJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);
  // Tracks a background submission whose job may not yet be visible in the
  // list (race condition). Keeping this flag ensures polling continues until
  // the job appears, so its progress and result are not lost.
  const [pendingBackgroundJobId, setPendingBackgroundJobId] = useState<
    number | undefined
  >();

  const refreshJobs = useCallback(async () => {
    if (!glossaryId) {
      setJobs([]);

      return;
    }
    setIsLoading(true);
    setHasLoadError(false);

    try {
      const response = await listOntologyBulkJobs(glossaryId, JOB_LIST_LIMIT);
      setJobs(response.jobs);
    } catch {
      setHasLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [glossaryId]);

  useEffect(() => {
    if (glossaryId) {
      void refreshJobs();
    } else {
      setJobs([]);
    }
    // Clear any pending submission flag when the glossary changes so a
    // stale flag from the previous glossary doesn't keep polling alive.
    setPendingBackgroundJobId(undefined);
  }, [glossaryId, refreshJobs]);

  const noteBackgroundSubmission = useCallback((jobId?: number) => {
    setPendingBackgroundJobId(jobId ?? PENDING_WITHOUT_ID);
  }, []);

  // Safety valve: clear the pending flag after a bounded window so polling
  // cannot run indefinitely if the job never appears in the list.
  useEffect(() => {
    if (pendingBackgroundJobId === undefined) {
      return undefined;
    }
    const timeout = setTimeout(
      () => setPendingBackgroundJobId(undefined),
      PENDING_SUBMISSION_TIMEOUT_MS
    );

    return () => clearTimeout(timeout);
  }, [pendingBackgroundJobId]);

  const hasActiveJobs = useMemo(
    () =>
      jobs.some(isActiveOntologyBulkJob) ||
      pendingBackgroundJobId !== undefined,
    [jobs, pendingBackgroundJobId]
  );

  usePollingEffect(refreshJobs, { enabled: hasActiveJobs });

  const cancelJob = useCallback(
    async (jobId: number) => {
      setIsCancelling(true);
      try {
        await cancelOntologyBulkJob(jobId);
        await refreshJobs();
      } finally {
        setIsCancelling(false);
      }
    },
    [refreshJobs]
  );

  return {
    cancelJob,
    hasLoadError,
    isCancelling,
    isLoading,
    jobs,
    noteBackgroundSubmission,
    refreshJobs,
  };
};
