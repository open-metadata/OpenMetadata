/*
 *  Copyright 2023 Collate.
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
import { Col, Row, Space, Steps, Typography } from 'antd';
import { isEmpty, isUndefined, last, toLower } from 'lodash';
import { ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { NO_DATA_PLACEHOLDER } from '../../../../constants/constants';
import { TEST_CASE_STATUS } from '../../../../constants/TestSuite.constant';
import { Thread } from '../../../../generated/entity/feed/thread';
import { TestCaseResolutionStatusTypes } from '../../../../generated/tests/testCaseResolutionStatus';
import { formatDateTime } from '../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../utils/EntityUtils';
import { useActivityFeedProvider } from '../../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { OwnerLabel } from '../../../common/OwnerLabel/OwnerLabel.component';
import RichTextEditorPreviewerV1 from '../../../common/RichTextEditor/RichTextEditorPreviewerV1';
import Severity from '../../../DataQuality/IncidentManager/Severity/Severity.component';
import './task-tab-incident-manager-header.style.less';

const TaskTabIncidentManagerHeader = ({ thread }: { thread: Thread }) => {
  const { t } = useTranslation();
  const { testCaseResolutionStatus } = useActivityFeedProvider();
  const testCaseResolutionStepper = useMemo(() => {
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

    return updatedData.map((status) => {
      let details: ReactNode = null;

      switch (status.testCaseResolutionStatusType) {
        case TestCaseResolutionStatusTypes.ACK:
          details = status.updatedBy ? (
            <Typography.Text className="text-grey-muted text-xss">
              {`By ${getEntityName(status.updatedBy)} on `}
            </Typography.Text>
          ) : null;

          break;
        case TestCaseResolutionStatusTypes.Assigned:
          details = status.testCaseResolutionStatusDetails?.assignee ? (
            <Typography.Text className="text-grey-muted text-xss">
              {`To ${getEntityName(
                status.testCaseResolutionStatusDetails?.assignee
              )} on `}
            </Typography.Text>
          ) : null;

          break;
        case TestCaseResolutionStatusTypes.Resolved:
          details = status.testCaseResolutionStatusDetails?.resolvedBy ? (
            <Typography.Text className="text-grey-muted text-xss">
              {`By ${getEntityName(
                status.testCaseResolutionStatusDetails.resolvedBy
              )} on `}
            </Typography.Text>
          ) : null;

          break;

        default:
          break;
      }

      return {
        className: toLower(status.testCaseResolutionStatusType),
        title: (
          <div>
            <Typography.Paragraph className="m-b-0">
              {status.testCaseResolutionStatusType}
            </Typography.Paragraph>
            <Typography.Paragraph className="m-b-0">
              {details}
              {status.updatedAt && (
                <Typography.Text className="text-grey-muted text-xss">
                  {formatDateTime(status.updatedAt)}
                </Typography.Text>
              )}
            </Typography.Paragraph>
          </div>
        ),
        key: status.testCaseResolutionStatusType,
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
    <Row data-testid="incident-manager-task-header-container" gutter={[8, 16]}>
      <Col span={24}>
        <div className="task-resolution-steps-container">
          <Steps
            className="task-resolution-steps w-full"
            current={testCaseResolutionStatus.length}
            data-testid="task-resolution-steps"
            items={testCaseResolutionStepper}
            labelPlacement="vertical"
            size="small"
          />
        </div>
      </Col>
      <Col span={24}>
        <Space className="justify-between w-full">
          <div className="gap-2 flex-center">
            <Typography.Text className="text-grey-muted">
              {`${t('label.assignee')}: `}
            </Typography.Text>
            {isUndefined(thread.task?.assignees) ||
            isEmpty(thread.task?.assignees) ? (
              NO_DATA_PLACEHOLDER
            ) : (
              <OwnerLabel owners={thread.task?.assignees} />
            )}
          </div>
          <div className="gap-2 flex-center">
            <Typography.Text className="text-grey-muted">
              {`${t('label.created-by')}: `}
            </Typography.Text>
            <OwnerLabel
              owners={[{ name: thread.createdBy, type: 'user', id: '' }]}
            />
          </div>
        </Space>
      </Col>
      <Col span={24}>
        <Space className="justify-between w-full">
          <div className="gap-2 flex-center">
            <Typography.Text className="text-grey-muted">
              {`${t('label.severity')}: `}
            </Typography.Text>
            <Severity severity={latestTestCaseResolutionStatus?.severity} />
          </div>
          {isResolved && (
            <div className="gap-2 flex-center" data-testid="failure-reason">
              <Typography.Text className="text-grey-muted">
                {`${t('label.failure-reason')}: `}
              </Typography.Text>
              {latestTestCaseResolutionStatus?.testCaseResolutionStatusDetails
                ?.testCaseFailureReason ?? NO_DATA_PLACEHOLDER}
            </div>
          )}
        </Space>
      </Col>
      {isResolved && (
        <Col span={24}>
          <Typography.Text className="text-grey-muted">
            {`${t('label.failure-comment')}: `}
          </Typography.Text>
          <RichTextEditorPreviewerV1
            markdown={
              latestTestCaseResolutionStatus?.testCaseResolutionStatusDetails
                ?.testCaseFailureComment ?? ''
            }
          />
        </Col>
      )}
    </Row>
  );
};

export default TaskTabIncidentManagerHeader;
