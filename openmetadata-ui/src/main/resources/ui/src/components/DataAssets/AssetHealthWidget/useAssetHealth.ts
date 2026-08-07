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
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { EntityType } from '../../../enums/entity.enum';
import { Table } from '../../../generated/entity/data/table';
import { PipelineType } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { getContractByEntityId } from '../../../rest/contractAPI';
import { getListTestCaseIncidentStatus } from '../../../rest/incidentManagerAPI';
import { getIngestionPipelines } from '../../../rest/ingestionPipelineAPI';
import { getTestCaseExecutionSummary } from '../../../rest/testAPI';
import {
  AssetHealthRow,
  UseAssetHealthResult,
} from './AssetHealthWidget.interface';
import {
  getContractHealthRow,
  getDataObservabilityHealthRow,
  getDataQualityHealthRow,
  getPipelineHealthRow,
} from './AssetHealthWidget.utils';

const INCIDENT_LIMIT = 50;

export const useAssetHealth = (table?: Table): UseAssetHealthResult => {
  const tableId = table?.id;
  const testSuiteId = table?.testSuite?.id;
  const serviceFqn = table?.service?.fullyQualifiedName;
  const tableFqn = table?.fullyQualifiedName;

  const summaryQuery = useQuery({
    queryKey: ['asset-health', 'test-summary', testSuiteId],
    queryFn: () => getTestCaseExecutionSummary(testSuiteId),
    enabled: Boolean(testSuiteId),
  });

  const incidentsQuery = useQuery({
    queryKey: ['asset-health', 'incidents', tableFqn],
    queryFn: () =>
      getListTestCaseIncidentStatus({
        latest: true,
        limit: INCIDENT_LIMIT,
        originEntityFQN: tableFqn,
      }),
    enabled: Boolean(testSuiteId),
  });

  // Uses the same key shape a future React Query contract consumer would, so the
  // entry is shared by entity id rather than scoped under asset-health.
  const contractQuery = useQuery({
    queryKey: ['contract', tableId, EntityType.TABLE],
    queryFn: () => getContractByEntityId(tableId ?? '', EntityType.TABLE),
    enabled: Boolean(tableId),
  });

  const pipelineQuery = useQuery({
    queryKey: ['asset-health', 'pipeline', serviceFqn],
    queryFn: () =>
      getIngestionPipelines({
        arrQueryFields: ['pipelineStatuses'],
        limit: 1,
        pipelineType: [PipelineType.Metadata],
        serviceFilter: serviceFqn,
      }),
    enabled: Boolean(serviceFqn),
  });

  const rows = useMemo<AssetHealthRow[]>(
    () => [
      getPipelineHealthRow(pipelineQuery.data?.data?.[0]),
      getDataQualityHealthRow(Boolean(testSuiteId), summaryQuery.data),
      getDataObservabilityHealthRow(
        Boolean(testSuiteId),
        incidentsQuery.data?.data ?? []
      ),
      getContractHealthRow(contractQuery.data),
    ],
    [
      pipelineQuery.data,
      summaryQuery.data,
      incidentsQuery.data,
      contractQuery.data,
      testSuiteId,
    ]
  );

  const isLoading =
    summaryQuery.isLoading ||
    incidentsQuery.isLoading ||
    contractQuery.isLoading ||
    pipelineQuery.isLoading;

  // The contract query is excluded: getContractByEntityId returns a 404 for the
  // common "no contract" case, which is already handled as the Create CTA row.
  const isError =
    pipelineQuery.isError || summaryQuery.isError || incidentsQuery.isError;

  return { rows, isLoading, isError };
};
