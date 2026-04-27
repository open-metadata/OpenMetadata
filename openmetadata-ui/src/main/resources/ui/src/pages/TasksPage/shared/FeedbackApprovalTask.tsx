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

import {
  BadgeWithDot,
  Grid,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Clock,
  CpuChip02,
  Database01,
  Flag04,
  MessageTextSquare01,
  UsersRight,
} from '@untitledui/icons';
import { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import UserPopOverCard from '../../../components/common/PopOverCard/UserPopOverCard';
import RichTextEditorPreviewerNew from '../../../components/common/RichTextEditor/RichTextEditorPreviewNew';
import { EntityType } from '../../../enums/entity.enum';
import {
  FeedbackType,
  RecognizerFeedback,
} from '../../../generated/entity/feed/thread';
import { Task } from '../../../rest/tasksAPI';
import { formatDateTime } from '../../../utils/date-time/DateTimeUtils';
import EntityLink from '../../../utils/EntityLink';
import { getEntityName } from '../../../utils/EntityUtils';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';

interface FeedbackApprovalTaskProps {
  task: Task;
}

const FeedbackApprovalTask: FC<FeedbackApprovalTaskProps> = ({ task }) => {
  const { t } = useTranslation();
  const payload =
    task?.payload && typeof task.payload === 'object'
      ? (task.payload as Record<string, unknown>)
      : undefined;
  const feedback = payload?.feedback as RecognizerFeedback | undefined;
  const recognizer =
    (payload?.recognizer as { recognizerName?: string } | undefined) ??
    undefined;
  const recognizerName = recognizer?.recognizerName || '';

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

  const entityLinkData = useMemo(() => {
    if (!feedback?.entityLink) {
      return null;
    }

    const entityType = EntityLink.getEntityType(feedback.entityLink);
    const entityFqn = EntityLink.getEntityFqn(feedback.entityLink);

    if (!entityType || !entityFqn) {
      return null;
    }

    return {
      entityPath: getEntityDetailsPath(entityType as EntityType, entityFqn),
      entityName: EntityLink.getEntityColumnFqn(feedback.entityLink),
    };
  }, [feedback?.entityLink]);

  if (!feedback) {
    return <div />;
  }

  return (
    <Grid
      className="tw:-mt-1.5"
      colGap="4"
      data-testid="feedback-approval-task"
      rowGap="4">
      {recognizerName && (
        <>
          <Grid.Item span={8}>
            <Typography
              as="p"
              className="tw:flex tw:items-center tw:text-gray-700 tw:gap-2">
              <CpuChip02 className="tw:shrink-0 tw:text-gray-500" size={16} />
              {t('label.recognizer')}
            </Typography>
          </Grid.Item>
          <Grid.Item span={16}>
            <Typography as="p" className="tw:text-gray-700">
              {recognizerName}
            </Typography>
          </Grid.Item>
        </>
      )}

      <Grid.Item span={8}>
        <Typography
          as="p"
          className="tw:flex tw:items-center tw:gap-2 tw:text-gray-700 tw:min-w-0">
          <Flag04 className="tw:shrink-0 tw:text-gray-500" size={16} />
          {t('label.feedback-type')}
        </Typography>
      </Grid.Item>
      <Grid.Item span={16}>
        <BadgeWithDot color="error" size="sm" type="pill-color">
          {feedbackTypeLabel}
        </BadgeWithDot>
      </Grid.Item>

      {feedback.userComments && (
        <>
          <Grid.Item span={8}>
            <Typography
              as="p"
              className="tw:flex tw:items-center tw:gap-2 tw:text-gray-700 tw:min-w-0">
              <MessageTextSquare01
                className="tw:shrink-0 tw:text-gray-500"
                size={16}
              />
              {t('label.comment-plural')}
            </Typography>
          </Grid.Item>
          <Grid.Item span={16}>
            <RichTextEditorPreviewerNew
              className="tw:text-gray-700 tw:text-xs"
              markdown={feedback.userComments}
              maxLength={100}
            />
          </Grid.Item>
        </>
      )}

      {feedback.createdBy && (
        <>
          <Grid.Item span={8}>
            <Typography
              as="p"
              className="tw:flex tw:items-center tw:gap-2 tw:text-gray-700 tw:min-w-0">
              <UsersRight className="tw:shrink-0 tw:text-gray-500" size={16} />
              {t('label.submitted-by')}
            </Typography>
          </Grid.Item>
          <Grid.Item span={16}>
            <UserPopOverCard
              showUserName
              displayName={getEntityName(feedback.createdBy)}
              profileWidth={22}
              userName={feedback.createdBy.name || '-'}
            />
          </Grid.Item>
        </>
      )}

      {feedback.createdAt && (
        <>
          <Grid.Item span={8}>
            <Typography
              as="p"
              className="tw:flex tw:items-center tw:gap-2 tw:text-gray-700 tw:min-w-0">
              <Clock className="tw:shrink-0 tw:text-gray-500" size={16} />
              {t('label.submitted-on')}
            </Typography>
          </Grid.Item>
          <Grid.Item span={16}>
            <Typography as="p" className="tw:text-gray-700">
              {formatDateTime(feedback.createdAt)}
            </Typography>
          </Grid.Item>
        </>
      )}

      {entityLinkData && (
        <>
          <Grid.Item span={8}>
            <Typography
              as="p"
              className="tw:flex tw:items-center tw:gap-2 tw:text-gray-700 tw:min-w-0">
              <Database01 className="tw:shrink-0 tw:text-gray-500" size={16} />
              {t('label.entity-link')}
            </Typography>
          </Grid.Item>
          <Grid.Item span={16}>
            <Link to={entityLinkData.entityPath}>
              <Typography
                as="p"
                className="tw:text-primary tw:font-medium tw:break-all">
                {entityLinkData.entityName}
              </Typography>
            </Link>
          </Grid.Item>
        </>
      )}
    </Grid>
  );
};

export default FeedbackApprovalTask;
