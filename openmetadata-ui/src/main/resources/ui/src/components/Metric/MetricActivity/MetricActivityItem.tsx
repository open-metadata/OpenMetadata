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
  Box,
  Button,
  Card,
  Typography,
} from '@openmetadata/ui-core-components';
import { Activity, MessageChatCircle } from '@untitledui/icons';
import { useTranslation } from 'react-i18next';
import { getShortRelativeTime } from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { MetricActivityListItem } from './MetricActivity.types';
import { getMetricActivityEventLabel } from './MetricActivity.utils';

export interface MetricActivityItemProps {
  isActive: boolean;
  item: MetricActivityListItem;
  onSelect: () => void;
}

const MetricActivityItem = ({
  isActive,
  item,
  onSelect,
}: MetricActivityItemProps) => {
  const { t } = useTranslation();
  const isEvent = item.kind === 'activity';
  const title = isEvent
    ? item.value.summary ?? getMetricActivityEventLabel(t, item.value.eventType)
    : item.value.message ?? t('label.conversation');
  const actor = isEvent
    ? item.value.actor
      ? getEntityName(item.value.actor)
      : t('label.system')
    : item.value.createdBy
    ? getEntityName(item.value.createdBy)
    : t('label.unknown');

  return (
    <Card isSelected={isActive}>
      <Card.Content className="tw:flex tw:items-start tw:gap-3">
        <Box
          align="center"
          className="tw:size-9 tw:shrink-0 tw:justify-center tw:rounded-lg tw:bg-utility-brand-50 tw:text-fg-brand-primary">
          {isEvent ? (
            <Activity aria-hidden="true" size={18} />
          ) : (
            <MessageChatCircle aria-hidden="true" size={18} />
          )}
        </Box>
        <Box className="tw:min-w-0 tw:flex-1" direction="col" gap={1}>
          <Button
            aria-pressed={isActive}
            className="tw:w-full tw:justify-start tw:text-left"
            color="link-gray"
            data-testid={`metric-activity-item-${item.id}`}
            onPress={onSelect}>
            <Typography
              className="tw:line-clamp-2"
              size="text-sm"
              weight="medium">
              {title}
            </Typography>
          </Button>
          <Typography className="tw:text-tertiary" size="text-xs">
            {actor} · {getShortRelativeTime(item.timestamp)}
          </Typography>
          {!isEvent && (
            <Typography className="tw:text-tertiary" size="text-xs">
              {t('label.reply-lowercase-plural')}: {item.value.replyCount}
            </Typography>
          )}
        </Box>
      </Card.Content>
    </Card>
  );
};

export default MetricActivityItem;
