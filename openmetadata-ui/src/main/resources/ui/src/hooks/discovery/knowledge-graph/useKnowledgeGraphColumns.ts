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

import { useEffect, useState } from 'react';
import { Column } from '../../generated/entity/data/table';
import { Include } from '../../generated/type/include';
import { getTableColumnsById } from '../../rest/tableAPI';

export const useKnowledgeGraphColumns = (
  entityId: string,
  enabled: boolean,
  refresh: number
) => {
  const [limit, setLimit] = useState(1000);
  const [state, setState] = useState<{
    id: string;
    columns: Column[];
    total: number;
    loading: boolean;
    error: unknown;
  }>({ id: '', columns: [], total: 0, loading: false, error: null });
  useEffect(() => setLimit(1000), [entityId]);
  useEffect(() => {
    if (!enabled || !entityId) {
      return;
    }
    const controller = new AbortController();
    setState((previous) => ({
      id: entityId,
      columns: previous.id === entityId ? previous.columns : [],
      total: previous.id === entityId ? previous.total : 0,
      loading: true,
      error: null,
    }));
    const load = async () => {
      const columns: Column[] = [];
      let total = 0;
      for (let offset = 0; offset < limit; offset += 1000) {
        const result = await getTableColumnsById(
          entityId,
          { limit: 1000, offset, fields: 'tags', include: Include.NonDeleted },
          controller.signal
        );
        if (controller.signal.aborted) {
          return;
        }
        columns.push(...result.data);
        total = result.paging.total;
        if (columns.length >= total || !result.data.length) {
          break;
        }
      }
      setState({ id: entityId, columns, total, loading: false, error: null });
    };
    void load().catch((error: unknown) => {
      if (!controller.signal.aborted) {
        setState((previous) => ({ ...previous, loading: false, error }));
      }
    });

    return () => controller.abort();
  }, [entityId, enabled, refresh, limit]);

  return {
    ...(state.id === entityId ? state : { ...state, columns: [], total: 0 }),
    loadMore: () => setLimit((value) => value + 1000),
  };
};
