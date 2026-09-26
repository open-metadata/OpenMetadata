/*
 *  Copyright 2025 Collate.
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
import { CSVExportResponse } from '../../../components/Entity/EntityExportModalProvider/EntityExportModalProvider.interface';
import { useLineageStore } from '../../../hooks/useLineageStore';
import { exportLineageAsync } from '../../../rest/lineageAPI';

/**
 * Bare wrapper around `exportLineageAsync`. `entityFqn`, `entityType`,
 * `lineageConfig` and `timeFilter` are all mirrored into `useLineageStore`
 * by `LineageProvider`'s bridge effects, so they are read from the store.
 * `queryFilter` is a per-render derived value (quick filters + domain scoping)
 * that is not published to the store, so it is passed in explicitly.
 */
export const exportLineageData = async (
  queryFilter: string
): Promise<CSVExportResponse> => {
  const { entityFqn, entityType, lineageConfig, timeFilter } =
    useLineageStore.getState();

  return exportLineageAsync(
    entityFqn,
    entityType ?? '',
    lineageConfig,
    queryFilter,
    timeFilter.startTime,
    timeFilter.endTime
  );
};
