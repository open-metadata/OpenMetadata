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
import { PlayCircle } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { useFocusable } from 'react-aria';
import { useTranslation } from 'react-i18next';
import { ResourceEntity } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { Operation } from '../../../../generated/entity/policies/policy';
import {
  PipelineState,
  PipelineType,
} from '../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { TestCase } from '../../../../generated/tests/testCase';
import { useEntityPermissions } from '../../../../hooks/useEntityPermissions/useEntityPermissions';
import { TEST_SUITE_PIPELINE_LIMIT } from '../../../../pages/IncidentManager/IncidentManagerDetailPage/IncidentManagerDetailPage.constants';
import { getIngestionPipelines } from '../../../../rest/ingestionPipelineAPI';
import { runTestCase } from '../../../../rest/testAPI';
import { getDerivedPermissionFlags } from '../../../../utils/PermissionDerivation';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import {
  getActiveRunState,
  getRunDisabledReasonKey,
  getRunnablePipeline,
  isRunInProgress,
} from './RunTestCaseButton.utils';

const RUN_PIPELINES_QUERY_KEY = 'test-case-run-pipelines';
const RUN_STATUS_POLL_INTERVAL_MS = 5000;
const PIPELINE_STATUS_FIELDS = ['pipelineStatuses'];
const ACTIVE_RUN_LABEL_KEYS: Partial<Record<PipelineState, string>> = {
  [PipelineState.Queued]: 'label.queued',
  [PipelineState.Running]: 'label.running',
};

interface RunTestCaseButtonProps {
  testCase: TestCase;
}

// A disabled button ignores the tooltip's trigger context, so the tooltip
// would never open on it; this focusable wrapper keeps the reason reachable by
// hover and keyboard without nesting the button in another button.
const DisabledReasonTrigger = ({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const { focusableProps } = useFocusable({}, ref);

  return (
    <span
      {...focusableProps}
      aria-label={label}
      className="tw:inline-flex"
      ref={ref}
      role="group">
      {children}
    </span>
  );
};

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
  const { permissions } = useEntityPermissions(
    ResourceEntity.INGESTION_PIPELINE,
    pipeline?.fullyQualifiedName ?? '',
    { enabled: Boolean(pipeline?.fullyQualifiedName) }
  );
  const canTrigger = getDerivedPermissionFlags(permissions).can(
    Operation.Trigger
  );
  const activeRunState = pipeline ? getActiveRunState(pipeline) : undefined;
  const runInProgress = activeRunState !== undefined;
  const disabledReasonKey = getRunDisabledReasonKey({
    canTrigger,
    pipelines,
    runInProgress,
  });

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
      await runTestCase(testCase.id ?? '');
      showSuccessToast(t('message.test-case-run-queued'));
      await refetch();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsTriggering(false);
    }
  };

  const button = (
    <Button
      showTextWhileLoading
      color="secondary"
      data-testid="run-test-case-button"
      iconLeading={PlayCircle}
      isDisabled={Boolean(disabledReasonKey) || isLoading}
      isLoading={isTriggering || runInProgress}
      size="sm"
      onClick={handleRun}>
      {t(
        (activeRunState && ACTIVE_RUN_LABEL_KEYS[activeRunState]) ??
          'label.run-now'
      )}
    </Button>
  );

  return disabledReasonKey ? (
    <Tooltip placement="top" title={t(disabledReasonKey)}>
      <DisabledReasonTrigger label={t(disabledReasonKey)}>
        {button}
      </DisabledReasonTrigger>
    </Tooltip>
  ) : (
    button
  );
};

export default RunTestCaseButton;
