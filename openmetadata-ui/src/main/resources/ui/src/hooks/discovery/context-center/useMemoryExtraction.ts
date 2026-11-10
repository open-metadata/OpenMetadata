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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { useState } from 'react';
import { MemoryExtractionAction } from '../../../constants/ContextCenter.constants';
import { ClientErrors } from '../../../enums/Axios.enum';
import { EntityReference } from '../../../generated/entity/type';
import { getExtractionAvailability } from '../../../rest/contextMemoryAPI';
import { CONTEXT_CENTER_EXTRACTION_AVAILABILITY_QUERY_KEY } from '../../../utils/ContextCenterQueryKeys';
import {
  canRequestMemoryExtraction,
  getExtractionUnavailableMessageKey,
} from '../../../utils/discovery/context-center/memoryExtraction.utils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useApplicationStore } from '../../useApplicationStore';

export interface MemoryExtractionOptions<T> {
  /** What the document's state offers; none offers nothing. */
  action?: MemoryExtractionAction;
  /** State kept for one document never shows on another. */
  documentId: string;
  owners?: EntityReference[];
  /** Reads the document again once the server refused what the UI showed. */
  reload: () => Promise<T>;
  request: () => Promise<T>;
  /** Takes the document as the server now reads it. */
  onUpdate: (document: T) => void;
}

export interface MemoryExtraction {
  /** None for anyone but the document's owners and admins, or once the server refused the user. */
  action?: MemoryExtractionAction;
  /** Set while extraction is unavailable: the action shows, disabled with this reason. */
  disabledReasonKey?: string;
  isRequesting: boolean;
  requestExtraction: () => Promise<void>;
}

/**
 * Extract or Retry on one file or article. The availability is read once and shared by every
 * action; a 409 that may say it changed reads it again.
 */
export const useMemoryExtraction = <T>({
  action,
  documentId,
  owners,
  reload,
  request,
  onUpdate,
}: MemoryExtractionOptions<T>): MemoryExtraction => {
  const { currentUser } = useApplicationStore();
  const queryClient = useQueryClient();
  const [requestingId, setRequestingId] = useState<string>();
  const [refusedId, setRefusedId] = useState<string>();
  const offeredAction =
    refusedId !== documentId && canRequestMemoryExtraction(currentUser, owners)
      ? action
      : undefined;
  const { data: availability } = useQuery({
    queryKey: CONTEXT_CENTER_EXTRACTION_AVAILABILITY_QUERY_KEY,
    queryFn: getExtractionAvailability,
    enabled: offeredAction !== undefined,
    staleTime: Infinity,
  });

  const reloadDocument = async () => {
    try {
      onUpdate(await reload());
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  // A 403 is final for this user; any other refusal means the document the UI showed was stale.
  const handleRefusal = (error: AxiosError) => {
    showErrorToast(error);
    const status = error.response?.status;
    if (status === ClientErrors.FORBIDDEN) {
      setRefusedId(documentId);

      return;
    }
    if (status === ClientErrors.CONFLICT) {
      void queryClient.invalidateQueries({
        queryKey: CONTEXT_CENTER_EXTRACTION_AVAILABILITY_QUERY_KEY,
      });
    }
    void reloadDocument();
  };

  const requestExtraction = async () => {
    setRequestingId(documentId);
    try {
      onUpdate(await request());
    } catch (error) {
      handleRefusal(error as AxiosError);
    } finally {
      setRequestingId((current) =>
        current === documentId ? undefined : current
      );
    }
  };

  return {
    action: offeredAction,
    disabledReasonKey: getExtractionUnavailableMessageKey(availability),
    isRequesting: requestingId === documentId,
    requestExtraction,
  };
};
