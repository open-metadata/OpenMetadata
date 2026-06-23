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
  Badge,
  Box,
  Button,
  Card,
  FeaturedIcon,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { ArrowNarrowRight, File05, Sun } from '@untitledui/icons';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as FolderIcon } from '../../../assets/svg/ic-folder-new.svg';
import {
  ActivityItem,
  ActivityKind,
  AiActivitySectionProps,
} from './AiActivitySection.interface';

const KIND_ICONS: Record<ActivityKind, FC<{ className?: string }>> = {
  memory: Sun,
  article: File05,
  document: FolderIcon,
};

function AiActivityRow({ item }: { readonly item: ActivityItem }) {
  const KindIcon = KIND_ICONS[item.kind];
  const { t } = useTranslation();

  return (
    <Box
      align="center"
      className="tw:py-3 tw:border-b tw:border-secondary last:tw:border-b-0"
      gap={3}>
      <FeaturedIcon
        className="tw:size-7 tw:rounded-md tw:shrink-0"
        color="brand"
        icon={KindIcon}
        size="sm"
        theme="light"
      />
      <div className="tw:flex-1 tw:min-w-0">
        <Box align="center" className="tw:mb-0.5" gap={2}>
          <Typography
            as="span"
            className="tw:text-quaternary tw:uppercase tw:tracking-widest tw:font-mono"
            size="text-xs">
            {item.kind}
          </Typography>
          <span className="tw:text-quaternary tw:text-xs">·</span>
          <Badge color="brand" size="sm" type="color">
            {`cited ${item.count}×`}
          </Badge>
        </Box>
        <Typography
          ellipsis
          as="div"
          className="tw:text-primary"
          size="text-xs"
          weight="medium">
          {item.title}
        </Typography>
        <Typography
          as="div"
          className="tw:text-quaternary tw:mt-0.5 tw:flex tw:items-baseline tw:gap-1"
          size="text-xs">
          {t('label.on')}
          <Typography
            as="span"
            className="tw:text-secondary"
            size="text-xs"
            weight="medium">
            {item.surface}
          </Typography>
          {` · ${t('label.last-cited-by')} ${item.who} ${item.when}`}
        </Typography>
      </div>
    </Box>
  );
}

function AiActivitySectionSkeleton() {
  return (
    <Card className="tw:p-5">
      <Box align="start" className="tw:mb-3.5" gap={3} justify="between">
        <Box direction="col" gap={2}>
          <Skeleton height={14} variant="rounded" width={120} />
          <Skeleton height={12} variant="rounded" width={200} />
        </Box>
        <Skeleton height={24} variant="rounded" width={80} />
      </Box>
      <Box direction="col">
        {[0, 1, 2, 3].map((i) => (
          <Box
            align="center"
            className="tw:py-3 tw:border-b tw:border-secondary last:tw:border-b-0"
            gap={3}
            key={i}>
            <Skeleton height={28} variant="rounded" width={28} />
            <Box className="tw:flex-1" direction="col" gap={2}>
              <Skeleton height={10} variant="rounded" width="40%" />
              <Skeleton height={12} variant="rounded" width="70%" />
              <Skeleton height={10} variant="rounded" width="55%" />
            </Box>
          </Box>
        ))}
      </Box>
    </Card>
  );
}

const AiActivitySection: FC<AiActivitySectionProps> = ({
  items,
  isLoading = false,
}) => {
  const { t } = useTranslation();

  if (isLoading) {
    return <AiActivitySectionSkeleton />;
  }

  return (
    <Card className="tw:p-5">
      <Box align="start" className="tw:mb-3.5" gap={3} justify="between">
        <div>
          <Typography
            as="div"
            className="tw:text-primary"
            size="text-sm"
            weight="medium">
            {t('label.used-by-ai')}
          </Typography>
          <Typography
            as="div"
            className="tw:text-quaternary tw:mt-0.5"
            size="text-xs">
            {t('message.most-cited-context-last-24h')}
          </Typography>
        </div>
        <Button
          color="link-color"
          iconTrailing={ArrowNarrowRight}
          size="xs"
          type="button">
          {t('label.view-activity')}
        </Button>
      </Box>

      {items.length === 0 ? (
        <Box align="center" className="tw:py-10" justify="center">
          <Typography as="div" className="tw:text-quaternary" size="text-xs">
            {t('message.no-ai-activity-yet')}
          </Typography>
        </Box>
      ) : (
        <div>
          {items.map((item) => (
            <AiActivityRow item={item} key={item.id} />
          ))}
        </div>
      )}
    </Card>
  );
};

export default AiActivitySection;
