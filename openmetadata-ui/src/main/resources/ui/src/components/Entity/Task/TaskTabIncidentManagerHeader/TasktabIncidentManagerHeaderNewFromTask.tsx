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

import {
  Box,
  Owner,
  ProgressStepItem,
  ProgressSteps,
  Typography,
} from '@openmetadata/ui-core-components';
import { Check } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { isEmpty, isUndefined, last } from 'lodash';
import { ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { NO_DATA_PLACEHOLDER } from '../../../../constants/constants';
import { TEST_CASE_STATUS } from '../../../../constants/TestSuite.constant';
import { TestCaseResolutionStatusTypes } from '../../../../generated/tests/testCaseResolutionStatus';
import { Task } from '../../../../rest/tasksAPI';
import { formatDateTime } from '../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { useActivityFeedProvider } from '../../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import RichTextEditorPreviewerV1 from '../../../common/RichTextEditor/RichTextEditorPreviewerV1';
import Severity from '../../../DataQuality/IncidentManager/Severity/Severity.component';
import './task-tab-incident-manager-header.style.less';

const STEP_STATUS_CLASS: Record<TestCaseResolutionStatusTypes, string> = {
  [TestCaseResolutionStatusTypes.New]:
    'tw:bg-utility-purple-50 tw:text-utility-purple-600 tw:outline-utility-purple-600',
  [TestCaseResolutionStatusTypes.ACK]:
    'tw:bg-utility-blue-50 tw:text-utility-blue-500 tw:outline-utility-blue-500',
  [TestCaseResolutionStatusTypes.Assigned]:
    'tw:bg-utility-yellow-50 tw:text-utility-yellow-500 tw:outline-utility-yellow-400',
  [TestCaseResolutionStatusTypes.Resolved]:
    'tw:bg-utility-green-50 tw:text-utility-green-500 tw:outline-utility-green-400',
};

// ProgressSteps only knows brand colours, so each step draws its own
// per-status disc over the (neutral, "incomplete") indicator.
const getStepIcon = (
  statusType: TestCaseResolutionStatusTypes,
  isDone: boolean,
  stepNumber: number
) => {
  const StepIcon = () => (
    <span
      className={classNames(
        'tw:flex tw:size-6 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full tw:text-xs tw:font-semibold tw:outline-1 tw:-outline-offset-1',
        STEP_STATUS_CLASS[statusType]
      )}>
      {isDone ? <Check className="tw:size-4" /> : stepNumber}
    </span>
  );

  return StepIcon;
};

const TaskTabIncidentManagerHeaderNewFromTask = ({ task }: { task: Task }) => {
  const { t } = useTranslation();
  const { testCaseResolutionStatus } = useActivityFeedProvider();

  const testCaseResolutionStepper = useMemo<ProgressStepItem[]>(() => {
    const updatedData = [...testCaseResolutionStatus];
    const lastStatusType = last(
      testCaseResolutionStatus
    )?.testCaseResolutionStatusType;

    if (lastStatusType && TEST_CASE_STATUS[lastStatusType]) {
      updatedData.push(
        ...TEST_CASE_STATUS[lastStatusType].map((type) => ({
          testCaseResolutionStatusType: type,
        }))
      );
    }

    return updatedData.map((status, index) => {
      let details: ReactNode = null;

      switch (status.testCaseResolutionStatusType) {
        case TestCaseResolutionStatusTypes.ACK:
          details = status.updatedBy ? (
            <Typography className="text-xss" color="secondary">
              {`By ${getEntityName(status.updatedBy)} on `}
            </Typography>
          ) : null;

          break;
        case TestCaseResolutionStatusTypes.Assigned:
          details = status.testCaseResolutionStatusDetails?.assignee ? (
            <Typography className="text-xss" color="secondary">
              {`To ${getEntityName(
                status.testCaseResolutionStatusDetails?.assignee
              )} on `}
            </Typography>
          ) : null;

          break;
        case TestCaseResolutionStatusTypes.Resolved:
          details = status.testCaseResolutionStatusDetails?.resolvedBy ? (
            <Typography className="text-xss" color="secondary">
              {`By ${getEntityName(
                status.testCaseResolutionStatusDetails.resolvedBy
              )} on `}
            </Typography>
          ) : null;

          break;

        default:
          break;
      }

      return {
        id: `${status.testCaseResolutionStatusType}-${index}`,
        icon: getStepIcon(
          status.testCaseResolutionStatusType,
          index < testCaseResolutionStatus.length,
          index + 1
        ),
        status: 'incomplete' as const,
        title: (
          <div>
            <Typography as="p" className="m-b-0 tw:text-primary">
              {status.testCaseResolutionStatusType}
            </Typography>
            <Typography as="p" className="m-b-0">
              {details}
              {status.updatedAt && (
                <Typography className="text-xss" color="secondary">
                  {formatDateTime(status.updatedAt)}
                </Typography>
              )}
            </Typography>
          </div>
        ),
      };
    });
  }, [testCaseResolutionStatus]);

  const latestTestCaseResolutionStatus = useMemo(
    () => last(testCaseResolutionStatus),
    [testCaseResolutionStatus]
  );

  const isResolved =
    latestTestCaseResolutionStatus?.testCaseResolutionStatusType ===
    TestCaseResolutionStatusTypes.Resolved;

  return (
    <Box
      data-testid="incident-manager-task-header-container"
      direction="col"
      gap={4}>
      <div className="task-resolution-steps-container">
        <ProgressSteps
          // Fixed-width steps scroll inside the container, as the antd Steps did,
          // instead of squeezing their labels together.
          className="task-resolution-steps w-full tw:*:min-w-32"
          data-testid="task-resolution-steps"
          size="sm"
          steps={testCaseResolutionStepper}
        />
      </div>
      <Box align="center" className="w-full" gap={2} justify="between">
        <Box align="center" gap={2} justify="center">
          <Typography color="secondary">
            {`${t('label.assignee')}: `}
          </Typography>
          {isUndefined(task.assignees) || isEmpty(task.assignees) ? (
            NO_DATA_PLACEHOLDER
          ) : (
            <Owner owners={task.assignees} />
          )}
        </Box>
        <Box align="center" gap={2} justify="center">
          <Typography color="secondary">
            {`${t('label.created-by')}: `}
          </Typography>
          {task.createdBy ? (
            <Owner owners={[task.createdBy]} />
          ) : (
            NO_DATA_PLACEHOLDER
          )}
        </Box>
      </Box>
      <Box align="center" className="w-full" gap={2} justify="between">
        <Box align="center" gap={2} justify="center">
          <Typography color="secondary">
            {`${t('label.severity')}: `}
          </Typography>
          <Severity severity={latestTestCaseResolutionStatus?.severity} />
        </Box>
        {isResolved && (
          <Box
            align="center"
            data-testid="failure-reason"
            gap={2}
            justify="center">
            <Typography color="secondary">
              {`${t('label.failure-reason')}: `}
            </Typography>
            {latestTestCaseResolutionStatus?.testCaseResolutionStatusDetails
              ?.testCaseFailureReason ?? NO_DATA_PLACEHOLDER}
          </Box>
        )}
      </Box>
      {isResolved && (
        <div>
          <Typography color="secondary">
            {`${t('label.failure-comment')}: `}
          </Typography>
          <RichTextEditorPreviewerV1
            markdown={
              latestTestCaseResolutionStatus?.testCaseResolutionStatusDetails
                ?.testCaseFailureComment ?? ''
            }
          />
        </div>
      )}
    </Box>
  );
};

export default TaskTabIncidentManagerHeaderNewFromTask;
