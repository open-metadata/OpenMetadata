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
  refreshJobs: () => Promise<void>;
}

export const useOntologyBulkJobs = (
  glossaryId: string | undefined
): UseOntologyBulkJobsResult => {
  const [jobs, setJobs] = useState<OntologyBulkJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);

  const refreshJobs = useCallback(async () => {
    setIsLoading(true);
    setHasLoadError(false);

    try {
      const response = await listOntologyBulkJobs();
      setJobs(response.jobs.filter((job) => job.glossary.id === glossaryId));
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
  }, [glossaryId, refreshJobs]);

  const hasActiveJobs = useMemo(
    () => jobs.some(isActiveOntologyBulkJob),
    [jobs]
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
    refreshJobs,
  };
};
