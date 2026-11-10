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
import { useTranslation } from 'react-i18next';
import { HTTP_STATUS_CODE } from '../../../constants/Auth.constants';
import { MemoryExtractionAction } from '../../../constants/ContextCenter.constants';
import { EntityReference } from '../../../generated/entity/type';
import { getExtractionAvailability } from '../../../rest/contextMemoryAPI';
import { CONTEXT_CENTER_EXTRACTION_AVAILABILITY_QUERY_KEY } from '../../../utils/ContextCenterQueryKeys';
import {
  canRequestMemoryExtraction,
  getExtractionUnavailableMessageKey,
} from '../../../utils/discovery/context-center/memoryExtraction.utils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useApplicationStore } from '../../useApplicationStore';

// One read serves the page; a minute later a focus or a new action reads it again.
const EXTRACTION_AVAILABILITY_STALE_TIME = 60 * 1000;

const CANNOT_START_MESSAGE_KEY = 'message.memory-extraction-cannot-start';

// A refusal is told in the user's language: the server's English text is for API callers.
const REFUSAL_MESSAGE_KEYS: Partial<Record<number, string>> = {
  [HTTP_STATUS_CODE.FORBIDDEN]:
    'message.memory-extraction-owners-or-admins-only',
  [HTTP_STATUS_CODE.CONFLICT]: CANNOT_START_MESSAGE_KEY,
  [HTTP_STATUS_CODE.SERVICE_UNAVAILABLE]:
    'message.memory-extraction-not-queued',
};

const getRefusalMessageKey = (status?: number) =>
  status === undefined ? undefined : REFUSAL_MESSAGE_KEYS[status];

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
 * Extract or Retry on one file or article. Every action on a page shares one availability read,
 * read again once it is a minute old or after a 409, whose message it then decides.
 */
export const useMemoryExtraction = <T>({
  action,
  documentId,
  owners,
  reload,
  request,
  onUpdate,
}: MemoryExtractionOptions<T>): MemoryExtraction => {
  const { t } = useTranslation();
  // Each Documents row runs this hook, so it re-renders on the signed-in user only.
  const currentUser = useApplicationStore((state) => state.currentUser);
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
    staleTime: EXTRACTION_AVAILABILITY_STALE_TIME,
    refetchOnWindowFocus: true,
  });

  const reloadDocument = async () => {
    try {
      onUpdate(await reload());
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  // A 409 can mean extraction went unavailable since it was read: read it again and say why.
  const readConflictMessageKey = async () => {
    try {
      const current = await queryClient.fetchQuery({
        queryKey: CONTEXT_CENTER_EXTRACTION_AVAILABILITY_QUERY_KEY,
        queryFn: getExtractionAvailability,
        staleTime: 0,
      });

      return (
        getExtractionUnavailableMessageKey(current) ?? CANNOT_START_MESSAGE_KEY
      );
    } catch {
      return CANNOT_START_MESSAGE_KEY;
    }
  };

  const notifyRefusal = async (error: AxiosError) => {
    const status = error.response?.status;
    const messageKey =
      status === HTTP_STATUS_CODE.CONFLICT
        ? await readConflictMessageKey()
        : getRefusalMessageKey(status);
    showErrorToast(messageKey ? t(messageKey) : error);
  };

  // A 403 is final for this user; any other refusal means the document the UI showed was stale.
  const handleRefusal = (error: AxiosError) => {
    void notifyRefusal(error);
    if (error.response?.status === HTTP_STATUS_CODE.FORBIDDEN) {
      setRefusedId(documentId);
    } else {
      void reloadDocument();
    }
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
