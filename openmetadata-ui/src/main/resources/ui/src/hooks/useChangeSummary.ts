/*
 *  Copyright 2024 Collate.
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

import { useCallback, useEffect, useState } from 'react';
import {
  ChangeSummaryEntry,
  ChangeSummaryParams,
  ChangeSummaryResponse,
  getChangeSummary,
} from '../rest/changeSummaryAPI';

interface UseChangeSummaryResult {
  changeSummary: Record<string, ChangeSummaryEntry>;
  totalEntries: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export const useChangeSummary = (
  entityType: string,
  entityId: string,
  params?: ChangeSummaryParams
): UseChangeSummaryResult => {
  const [changeSummary, setChangeSummary] = useState<
    Record<string, ChangeSummaryEntry>
  >({});
  const [totalEntries, setTotalEntries] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [refetchCount, setRefetchCount] = useState(0);

  const refetch = useCallback(() => {
    setRefetchCount((c) => c + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      if (!entityType || !entityId) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response: ChangeSummaryResponse = await getChangeSummary(
          entityType,
          entityId,
          params
        );
        if (!cancelled) {
          setChangeSummary(response.changeSummary ?? {});
          setTotalEntries(response.totalEntries ?? 0);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setChangeSummary({});
          setTotalEntries(0);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [
    entityType,
    entityId,
    params?.fieldPrefix,
    params?.limit,
    params?.offset,
    refetchCount,
  ]);

  return {
    changeSummary,
    totalEntries,
    isLoading,
    error,
    refetch,
  };
};
