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

import { Box, Chip, Typography, useTheme } from '@mui/material';
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
  TaskDetails,
} from '../../../generated/entity/feed/thread';
import { formatDateTime } from '../../../utils/date-time/DateTimeUtils';
import EntityLink from '../../../utils/EntityLink';
import { getEntityName } from '../../../utils/EntityUtils';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';

interface FeedbackApprovalTaskProps {
  task: TaskDetails;
}

const FeedbackApprovalTask: FC<FeedbackApprovalTaskProps> = ({ task }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const feedback: RecognizerFeedback | undefined = task?.feedback;
  const recognizerName = task?.recognizer?.recognizerName || '';

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

  const rowStyle = {
    gap: 3,
    display: 'flex',
    alignItems: 'flex-start',
  };

  const labelStyle = {
    pl: 2,
    gap: 2,
    minWidth: 0,
    display: 'flex',
    flex: '0 0 45%',
    maxWidth: '45%',
    alignItems: 'center',
    color: theme.palette.grey[700],
  };

  return (
    <Box
      className="feedback-approval-task"
      data-testid="feedback-approval-task"
      sx={{
        display: 'flex',
        rowGap: 4,
        flexDirection: 'column',
        mt: -1.5,
        maxWidth: '405px',
      }}>
      {recognizerName && (
        <Box sx={rowStyle}>
          <Typography sx={labelStyle} variant="body2">
            <CpuChip02 className="text-grey-muted" size={16} />
            {t('label.recognizer')}
          </Typography>
          <Typography color={theme.palette.grey[700]} variant="body2">
            {recognizerName}
          </Typography>
        </Box>
      )}
      <Box sx={rowStyle}>
        <Typography sx={labelStyle} variant="body2">
          <Flag04 className="text-grey-muted" size={16} />
          {t('label.feedback-type')}
        </Typography>
        <Chip
          icon={
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: theme.palette.error.main,
              }}
            />
          }
          label={feedbackTypeLabel}
          size="small"
          sx={{
            display: 'inline-flex',
            padding: '2px 6px',
            alignItems: 'center',
            gap: '6px',
            borderRadius: '6px',
            color: theme.palette.grey[700],
            border: `0.5px solid ${theme.palette.grey[300]}`,
            background: theme.palette.background.paper,
            boxShadow: '0 1px 2px 0 @grey-27',
            '& .MuiChip-icon': {
              marginLeft: 0,
              marginRight: 0,
            },
          }}
        />
      </Box>

      {feedback.userComments && (
        <Box sx={rowStyle}>
          <Typography sx={labelStyle} variant="body2">
            <MessageTextSquare01 className="text-grey-muted" size={16} />
            {t('label.comment-plural')}
          </Typography>
          <Box
            sx={{
              '& .ProseMirror p, button': {
                fontSize: theme.typography.caption.fontSize,
              },
            }}>
            <RichTextEditorPreviewerNew
              className="text-grey-700"
              markdown={feedback.userComments}
              maxLength={100}
            />
          </Box>
        </Box>
      )}

      {feedback.createdBy && (
        <Box sx={rowStyle}>
          <Typography sx={labelStyle} variant="body2">
            <UsersRight className="text-grey-muted" size={16} />
            {t('label.submitted-by')}
          </Typography>
          <UserPopOverCard
            showUserName
            displayName={getEntityName(feedback.createdBy)}
            profileWidth={22}
            userName={feedback.createdBy.name || '-'}
          />
        </Box>
      )}

      {feedback.createdAt && (
        <Box sx={rowStyle}>
          <Typography sx={labelStyle} variant="body2">
            <Clock className="text-grey-muted" size={16} />
            {t('label.submitted-on')}
          </Typography>
          <Typography
            color={theme.palette.grey[700]}
            fontSize={theme.typography.caption.fontSize}
            variant="body2">
            {formatDateTime(feedback.createdAt)}
          </Typography>
        </Box>
      )}

      {entityLinkData && (
        <Box sx={rowStyle}>
          <Typography sx={labelStyle} variant="body2">
            <Database01 className="text-grey-muted" size={16} />
            {t('label.entity-link')}
          </Typography>
          <Link to={entityLinkData.entityPath}>
            <Typography
              color={theme.palette.primary.main}
              fontSize={theme.typography.caption.fontSize}
              fontWeight={theme.typography.body1.fontWeight}
              sx={{ lineBreak: 'anywhere' }}
              variant="body2">
              {entityLinkData.entityName}
            </Typography>
          </Link>
        </Box>
      )}
    </Box>
  );
};

export default FeedbackApprovalTask;
