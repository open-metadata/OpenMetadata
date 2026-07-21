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

import { useEffect, useRef, useState } from 'react';
import { OntologyEditLock } from '../../../generated/type/ontologyEditLock';
import {
  acquireOntologyEditLock,
  getOntologyEditLock,
  releaseOntologyEditLock,
  renewOntologyEditLock,
} from '../../../rest/ontologyAPI';
import { generateUUID } from '../../../utils/StringUtils';

const LEASE_SECONDS = 60;
const HEARTBEAT_MILLIS = 20_000;

export type OntologyEditLeaseState =
  | 'idle'
  | 'acquiring'
  | 'owned'
  | 'contended'
  | 'lost';

interface UseOntologyEditLeaseOptions {
  isActive: boolean;
  resourceId?: string;
  resourceType: string;
}

export const useOntologyEditLease = ({
  isActive,
  resourceId,
  resourceType,
}: UseOntologyEditLeaseOptions) => {
  const sessionId = useRef(generateUUID());
  const lock = useRef<OntologyEditLock>();
  const [visibleLock, setVisibleLock] = useState<OntologyEditLock>();
  const [state, setState] = useState<OntologyEditLeaseState>('idle');
  const [retryCount, setRetryCount] = useState(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let isCurrent = true;
    let heartbeat: number | undefined;

    const request = (expectedVersion?: number) => ({
      expectedVersion,
      leaseSeconds: LEASE_SECONDS,
      resourceId: resourceId ?? '',
      resourceType,
      sessionId: sessionId.current,
    });

    const publishOwnedLock = (nextLock: OntologyEditLock) => {
      lock.current = nextLock;
      setVisibleLock(nextLock);
      setState('owned');
    };

    const discoverHolder = async () => {
      try {
        const activeLock = await getOntologyEditLock(
          resourceType,
          resourceId ?? ''
        );
        if (isCurrent) {
          setVisibleLock(activeLock);
          setState('contended');
        }
      } catch {
        if (isCurrent) {
          setVisibleLock(undefined);
          setState('lost');
        }
      }
    };

    async function renew() {
      try {
        const renewed = await renewOntologyEditLock(
          request(lock.current?.version)
        );
        if (isCurrent) {
          publishOwnedLock(renewed);
          heartbeat = window.setTimeout(renew, HEARTBEAT_MILLIS);
        } else {
          await releaseOntologyEditLock(
            resourceType,
            resourceId ?? '',
            sessionId.current
          );
        }
      } catch {
        // A transient heartbeat failure or a version drift should self-heal by
        // re-acquiring a fresh lease rather than dropping edit access outright.
        if (isCurrent) {
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          await acquire();
        }
      }
    }

    async function acquire() {
      // Keep the owned state while re-acquiring (glossary switch or heartbeat
      // recovery) so editing controls do not flicker to disabled.
      if (stateRef.current !== 'owned') {
        setState('acquiring');
        setVisibleLock(undefined);
      }
      try {
        const acquired = await acquireOntologyEditLock(request());
        if (isCurrent) {
          publishOwnedLock(acquired);
          heartbeat = window.setTimeout(renew, HEARTBEAT_MILLIS);
        } else {
          await releaseOntologyEditLock(
            resourceType,
            resourceId ?? '',
            sessionId.current
          );
        }
      } catch {
        if (isCurrent) {
          await discoverHolder();
        }
      }
    }

    if (isActive && resourceId) {
      void acquire();
    } else {
      lock.current = undefined;
      setVisibleLock(undefined);
      setState('idle');
    }

    return () => {
      isCurrent = false;
      window.clearTimeout(heartbeat);
      if (lock.current && resourceId) {
        void releaseOntologyEditLock(
          resourceType,
          resourceId,
          sessionId.current
        );
      }
      lock.current = undefined;
    };
  }, [isActive, resourceId, resourceType, retryCount]);

  return {
    isOwned: state === 'owned',
    lock: visibleLock,
    retry: () => setRetryCount((count) => count + 1),
    state,
  };
};
