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

import { Col, Row, Space, Tag, Typography } from 'antd';
import { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EntityType } from '../../../enums/entity.enum';
import {
  FeedbackType,
  RecognizerFeedback,
  TaskDetails,
} from '../../../generated/entity/feed/thread';
import { formatDateTime } from '../../../utils/date-time/DateTimeUtils';
import { getEntityLinkFromType } from '../../../utils/EntityUtils';
import { getEntityFQN, getEntityType } from '../../../utils/FeedUtils';
import { getUserPath } from '../../../utils/RouterUtils';

interface FeedbackApprovalTaskProps {
  task: TaskDetails;
}

const FeedbackApprovalTask: FC<FeedbackApprovalTaskProps> = ({ task }) => {
  const { t } = useTranslation();
  const feedback: RecognizerFeedback | undefined = task?.feedback;

  const feedbackTypeLabel = useMemo(() => {
    if (!feedback?.feedbackType) {
      return '';
    }

    const typeMap: Record<FeedbackType, string> = {
      [FeedbackType.FalsePositive]: t('label.feedback-type-false-positive'),
      [FeedbackType.IncorrectClassification]: t(
        'label.feedback-type-incorrect-classification'
      ),
      [FeedbackType.OverlyBroad]: t('label.feedback-type-overly-broad'),
      [FeedbackType.ContextSpecific]: t('label.feedback-type-context-specific'),
    };

    return typeMap[feedback.feedbackType] || feedback.feedbackType;
  }, [feedback?.feedbackType, t]);

  const entityLinkUrl = useMemo(() => {
    if (!feedback?.entityLink) {
      return null;
    }

    const entityType = getEntityType(feedback.entityLink);
    const entityFqn = getEntityFQN(feedback.entityLink);

    if (!entityType || !entityFqn) {
      return null;
    }

    return getEntityLinkFromType(entityFqn, entityType as EntityType);
  }, [feedback?.entityLink]);

  if (!feedback) {
    return <div />;
  }

  return (
    <div
      className="feedback-approval-task"
      data-testid="feedback-approval-task">
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Space direction="vertical" size="small">
            <div>
              <Typography.Text strong>
                {t('label.feedback-type')}:{' '}
              </Typography.Text>
              <Tag>{feedbackTypeLabel}</Tag>
            </div>

            {feedback.userComments && (
              <div>
                <Typography.Text strong>
                  {t('label.comment-plural')}:{' '}
                </Typography.Text>
                <Typography.Text>{feedback.userComments}</Typography.Text>
              </div>
            )}

            {feedback.createdBy && (
              <div>
                <Typography.Text strong>
                  {t('label.submitted-by')}:{' '}
                </Typography.Text>
                <Link to={getUserPath(feedback.createdBy.name ?? '')}>
                  {feedback.createdBy.displayName || feedback.createdBy.name}
                </Link>
              </div>
            )}

            {feedback.createdAt && (
              <div>
                <Typography.Text strong>
                  {t('label.submitted-on')}:{' '}
                </Typography.Text>
                <Typography.Text>
                  {formatDateTime(feedback.createdAt)}
                </Typography.Text>
              </div>
            )}

            {feedback.entityLink && (
              <div>
                <Typography.Text strong>
                  {t('label.entity-link')}:{' '}
                </Typography.Text>
                {entityLinkUrl ? (
                  <Link target="_blank" to={entityLinkUrl}>
                    <Typography.Text code>
                      {feedback.entityLink}
                    </Typography.Text>
                  </Link>
                ) : (
                  <Typography.Text code>{feedback.entityLink}</Typography.Text>
                )}
              </div>
            )}
          </Space>
        </Col>
      </Row>
    </div>
  );
};

export default FeedbackApprovalTask;
