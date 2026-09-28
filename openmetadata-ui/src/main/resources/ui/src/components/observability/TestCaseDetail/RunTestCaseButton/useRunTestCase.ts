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
import { isUndefined } from 'lodash';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { EntityType } from '../../../../enums/entity.enum';
import { ResourceEntity } from '../../../../enums/permissions.enum';
import { PipelineType as RunPipelineType } from '../../../../generated/api/services/ingestionPipelines/runIngestionPipelineForEntity';
import { Operation } from '../../../../generated/entity/policies/policy';
import { PipelineType } from '../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { TestCase } from '../../../../generated/tests/testCase';
import { useEntityPermissions } from '../../../../hooks/useEntityPermissions/useEntityPermissions';
import { TEST_SUITE_PIPELINE_LIMIT } from '../../../../pages/IncidentManager/IncidentManagerDetailPage/IncidentManagerDetailPage.constants';
import {
  getIngestionPipelines,
  runIngestionPipelineForEntity,
} from '../../../../rest/ingestionPipelineAPI';
import { getEntityFeedLink } from '../../../../utils/EntityPureUtils';
import { getDerivedPermissionFlags } from '../../../../utils/PermissionDerivation';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import {
  getActiveRunState,
  getRunDisabledReasonKey,
  getRunnablePipeline,
  getTriggerPermissions,
  isRunInProgress,
} from './RunTestCaseButton.utils';

const RUN_PIPELINES_QUERY_KEY = 'test-case-run-pipelines';
const RUN_STATUS_POLL_INTERVAL_MS = 5000;
const PIPELINE_STATUS_FIELDS = ['pipelineStatuses'];

/**
 * Everything a control needs to run a single test case on demand: whether the
 * user may, why it is unavailable, whether a run is already going, and the
 * trigger itself. Shared by the header's Run now and the run details Retry.
 */
export const useRunTestCase = (testCase: TestCase) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isTriggering, setIsTriggering] = useState(false);
  const testSuiteFqn = testCase.testSuite?.fullyQualifiedName;

  const {
    data: pipelines = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [RUN_PIPELINES_QUERY_KEY, testSuiteFqn],
    queryFn: async () =>
      (
        await getIngestionPipelines({
          arrQueryFields: PIPELINE_STATUS_FIELDS,
          limit: TEST_SUITE_PIPELINE_LIMIT,
          pipelineType: [PipelineType.TestSuite],
          testSuite: testSuiteFqn,
        })
      ).data,
    enabled: Boolean(testSuiteFqn),
    refetchInterval: (query) => {
      const pipeline = getRunnablePipeline(query.state.data ?? []);

      return pipeline && isRunInProgress(pipeline)
        ? RUN_STATUS_POLL_INTERVAL_MS
        : false;
    },
  });

  const pipeline = getRunnablePipeline(pipelines);
  const { permissions: resourcePermissions } = usePermissionProvider();
  const { permissions: pipelinePermissions, isLoading: isPermissionLoading } =
    useEntityPermissions(
      ResourceEntity.INGESTION_PIPELINE,
      pipeline?.fullyQualifiedName ?? '',
      { enabled: Boolean(pipeline?.fullyQualifiedName) }
    );
  const canTrigger = getDerivedPermissionFlags(
    getTriggerPermissions(
      pipeline,
      pipelinePermissions,
      resourcePermissions[ResourceEntity.INGESTION_PIPELINE]
    )
  ).can(Operation.Trigger);
  const activeRunState = getActiveRunState(pipeline);
  const runInProgress = !isUndefined(activeRunState);

  // A finished run changed the test case's latest result, so reload the test case the page shows.
  const wasRunInProgress = useRef(runInProgress);
  useEffect(() => {
    if (wasRunInProgress.current && !runInProgress) {
      queryClient.invalidateQueries({
        queryKey: ['testCase', testCase.fullyQualifiedName],
      });
    }
    wasRunInProgress.current = runInProgress;
  }, [runInProgress, queryClient, testCase.fullyQualifiedName]);

  const run = async () => {
    setIsTriggering(true);
    try {
      await runIngestionPipelineForEntity({
        entityLink: getEntityFeedLink(
          EntityType.TEST_CASE,
          testCase.fullyQualifiedName
        ),
        pipelineType: RunPipelineType.TestSuite,
      });
      showSuccessToast(t('message.test-case-run-queued'));
      await refetch();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsTriggering(false);
    }
  };

  return {
    activeRunState,
    // Known only once pipelines and permission have loaded, so a control never flashes in and then vanishes.
    canRun: !isLoading && !isPermissionLoading && canTrigger,
    disabledReasonKey: getRunDisabledReasonKey(pipelines),
    isTriggering,
    run,
    runInProgress,
  };
};
