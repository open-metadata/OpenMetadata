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
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  OntologyPackInstallJob,
  Status,
} from '../../../generated/api/data/ontologyPackInstallJob';
import {
  cancelNativeOntologyPackInstallJob,
  getNativeOntologyPackInstallJob,
  installNativeOntologyPack,
} from '../../../rest/ontologyAPI';

const POLL_INTERVAL_MS = 1000;
// A few failed reads in a row mean the network is down, not that the job stopped.
const MAX_CONSECUTIVE_POLL_FAILURES = 5;

export const isInstallJobSettled = (job: OntologyPackInstallJob) =>
  job.status === Status.Completed ||
  job.status === Status.Failed ||
  job.status === Status.Cancelled;

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

/**
 * Starts a library install job and follows it to a settled state. Starting
 * again while the same install runs joins that job, so a retry after a lost
 * response never races a second job.
 */
export const useOntologyPackInstallJob = () => {
  const [job, setJob] = useState<OntologyPackInstallJob>();
  const generation = useRef(0);

  useEffect(
    () => () => {
      generation.current += 1;
    },
    []
  );

  const run = useCallback(
    async (ontologyId: string, packId: string, moduleIds: string[]) => {
      generation.current += 1;
      const mine = generation.current;
      let current = await installNativeOntologyPack(ontologyId, packId, {
        moduleIds,
      });
      let failures = 0;
      while (generation.current === mine) {
        setJob(current);
        if (isInstallJobSettled(current)) {
          return current;
        }
        await sleep(POLL_INTERVAL_MS);
        try {
          current = await getNativeOntologyPackInstallJob(
            ontologyId,
            current.id
          );
          failures = 0;
        } catch (error) {
          failures += 1;
          if (failures >= MAX_CONSECUTIVE_POLL_FAILURES) {
            throw error;
          }
        }
      }

      return undefined;
    },
    []
  );

  const cancel = useCallback(async () => {
    if (job && !isInstallJobSettled(job)) {
      setJob(await cancelNativeOntologyPackInstallJob(job.ontologyId, job.id));
    }
  }, [job]);

  return { job, run, cancel };
};
