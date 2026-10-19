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

import { AxiosError } from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OntologyMemoryProposalStatus } from '../../../generated/api/data/ontologyMemoryProposalStatus';
import {
  getMemoryOntologyProposalStatus,
  proposeTermFromMemory,
} from '../../../rest/ontologyAPI';
import { getErrorText } from '../../../utils/StringUtils';
import { showSuccessToast } from '../../../utils/ToastUtils';

const STATUS_POLL_INTERVAL_MS = 5_000;

// Proposal status is auxiliary to the memory: a failed lookup leaves it unset, which hides the
// derived-ontology actions, instead of putting an error banner over the whole memory.
const loadStatus = (
  memoryId: string,
  onLoaded: (status: OntologyMemoryProposalStatus) => void
) =>
  getMemoryOntologyProposalStatus(memoryId)
    .then(onLoaded)
    .catch(() => undefined);

export const useMemoryOntologyProposals = (
  memoryId: string | undefined,
  isOpen: boolean
) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<OntologyMemoryProposalStatus>();
  const [isProposing, setIsProposing] = useState(false);
  const [proposeError, setProposeError] = useState<string>();
  const isQueued = Boolean(status?.queued);

  useEffect(() => {
    setStatus(undefined);
    setProposeError(undefined);
    if (!isOpen || !memoryId) {
      return;
    }
    let isCurrent = true;
    loadStatus(memoryId, (next) => {
      if (isCurrent) {
        setStatus(next);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [isOpen, memoryId]);

  useEffect(() => {
    if (!isOpen || !memoryId || !isQueued) {
      return;
    }
    let isCurrent = true;
    const interval = window.setInterval(
      () =>
        loadStatus(memoryId, (next) => {
          if (isCurrent) {
            setStatus(next);
          }
        }),
      STATUS_POLL_INTERVAL_MS
    );

    return () => {
      isCurrent = false;
      window.clearInterval(interval);
    };
  }, [isOpen, memoryId, isQueued]);

  const propose = useCallback(async () => {
    if (!memoryId) {
      return;
    }
    setIsProposing(true);
    setProposeError(undefined);
    try {
      await proposeTermFromMemory(memoryId);
      setStatus(
        (current) =>
          current && {
            ...current,
            proposals: [],
            queued: true,
            lastJob: undefined,
          }
      );
      showSuccessToast(t('label.queued'));
    } catch (error) {
      setProposeError(
        getErrorText(error as AxiosError, t('server.unexpected-error'))
      );
    } finally {
      setIsProposing(false);
    }
  }, [memoryId, t]);

  return { status, isProposing, proposeError, propose };
};
