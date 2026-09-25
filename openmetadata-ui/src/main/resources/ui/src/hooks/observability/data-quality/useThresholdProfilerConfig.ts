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
import { TableProfilerConfig } from '../../../generated/entity/data/table';
import { TestDefinition } from '../../../generated/tests/testDefinition';
import { getTableProfilerConfig } from '../../../rest/tableAPI';
import { hasThresholdUnitParam } from '../../../utils/observability/data-quality/testCaseThreshold.utils';

/**
 * A threshold is measured on whatever the profiler actually reads, so the
 * preview has to say when that is a sample. `tableProfilerConfig` is not a
 * `fields` option on GET /tables, hence its own request — and it is only worth
 * making for a test that has a threshold at all. Any failure (most likely a
 * missing ViewDataProfile permission) just drops the note.
 */
export const useThresholdProfilerConfig = (
  definition: TestDefinition | undefined,
  tableId: string | undefined
): TableProfilerConfig | undefined => {
  const [profilerConfig, setProfilerConfig] = useState<TableProfilerConfig>();
  const profiledTableId = hasThresholdUnitParam(definition)
    ? tableId
    : undefined;

  useEffect(() => {
    if (!profiledTableId) {
      setProfilerConfig(undefined);

      return;
    }

    let cancelled = false;
    const fetchProfilerConfig = async () => {
      try {
        const response = await getTableProfilerConfig(profiledTableId);
        if (!cancelled) {
          setProfilerConfig(response?.tableProfilerConfig);
        }
      } catch {
        if (!cancelled) {
          setProfilerConfig(undefined);
        }
      }
    };
    fetchProfilerConfig();

    return () => {
      cancelled = true;
    };
  }, [profiledTableId]);

  return profilerConfig;
};
