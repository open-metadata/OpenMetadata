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
import { Button, Tooltip } from '@openmetadata/ui-core-components';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Play } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { isUndefined } from 'lodash';
import { useEffect, useRef, useState } from 'react';
import { Focusable } from 'react-aria-components';
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
  getRunButtonLabelKey,
  getRunDisabledReasonKey,
  getRunnablePipeline,
  getTriggerPermissions,
  isRunInProgress,
} from './RunTestCaseButton.utils';

const RUN_PIPELINES_QUERY_KEY = 'test-case-run-pipelines';
const RUN_STATUS_POLL_INTERVAL_MS = 5000;
const PIPELINE_STATUS_FIELDS = ['pipelineStatuses'];
interface RunTestCaseButtonProps {
  testCase: TestCase;
}

const RunTestCaseButton = ({ testCase }: RunTestCaseButtonProps) => {
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
  const disabledReasonKey = getRunDisabledReasonKey(pipelines);

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

  const handleRun = async () => {
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

  // Rendered only once the permission is known, so the button never flashes in and then vanishes.
  if (isLoading || isPermissionLoading || !canTrigger) {
    return null;
  }

  const button = (
    <Button
      showTextWhileLoading
      color="primary"
      data-testid="run-test-case-button"
      iconLeading={Play}
      isDisabled={Boolean(disabledReasonKey)}
      isLoading={isTriggering}
      size="sm"
      onClick={handleRun}>
      {t(getRunButtonLabelKey(activeRunState))}
    </Button>
  );

  // A disabled button ignores the tooltip's trigger context, so the tooltip would
  // never open on it. Focusable hands that context to the span instead, keeping
  // the reason reachable by hover and keyboard without nesting a button in a button.
  if (disabledReasonKey) {
    return (
      <Tooltip placement="top" title={t(disabledReasonKey)}>
        <Focusable>
          <span
            aria-label={t(disabledReasonKey)}
            className="tw:inline-flex"
            role="group">
            {button}
          </span>
        </Focusable>
      </Tooltip>
    );
  }

  // A run in progress does not block another; the button stays usable and says what a click does.
  return runInProgress ? (
    <Tooltip
      placement="top"
      title={t('message.test-case-run-already-in-progress')}>
      {button}
    </Tooltip>
  ) : (
    button
  );
};

export default RunTestCaseButton;
