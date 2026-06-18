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
  BadgeWithDot,
  Box,
  Button,
  Card,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { ArrowNarrowRight, File05, Sun } from '@untitledui/icons';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as FolderIcon } from '../../../assets/svg/ic-folder-new.svg';
import { ATTENTION_SEVERITY_BADGE_COLOR } from '../../../constants/ContextCenter.constants';
import {
  AttentionItem,
  AttentionKind,
  NeedsAttentionSectionProps,
} from './NeedsAttentionSection.interface';

const KIND_ICONS: Record<AttentionKind, FC<{ className?: string }>> = {
  memory: Sun,
  article: File05,
  document: FolderIcon,
};

function NeedsAttentionRow({ item }: { readonly item: AttentionItem }) {
  const { t } = useTranslation();
  const KindIcon = KIND_ICONS[item.kind];

  return (
    <Box
      align="start"
      className="tw:py-3 tw:border-b tw:border-secondary last:tw:border-b-0"
      gap={3}>
      <KindIcon className="tw:size-4 tw:text-quaternary tw:mt-0.5 tw:shrink-0" />
      <div className="tw:flex-1 tw:min-w-0">
        <Typography
          ellipsis
          as="div"
          className="tw:text-primary"
          size="text-xs"
          weight="medium">
          {item.title}
        </Typography>
        <div className="tw:mt-1">
          <BadgeWithDot
            color={ATTENTION_SEVERITY_BADGE_COLOR[item.severity]}
            size="sm"
            type="color">
            {item.reason}
          </BadgeWithDot>
        </div>
      </div>
      <Button
        color="link-color"
        iconTrailing={ArrowNarrowRight}
        size="xs"
        type="button">
        {t('label.resolve')}
      </Button>
    </Box>
  );
}

function NeedsAttentionSectionSkeleton() {
  return (
    <Card className="tw:p-5">
      <Box align="start" className="tw:mb-3.5" gap={3} justify="between">
        <Box direction="col" gap={2}>
          <Skeleton height={14} variant="rounded" width={120} />
          <Skeleton height={12} variant="rounded" width={180} />
        </Box>
        <Skeleton height={22} variant="rounded" width={24} />
      </Box>
      <Box direction="col">
        {[0, 1, 2, 3].map((i) => (
          <Box
            align="start"
            className="tw:py-3 tw:border-b tw:border-secondary last:tw:border-b-0"
            gap={3}
            key={i}>
            <Skeleton height={16} variant="rounded" width={16} />
            <Box className="tw:flex-1" direction="col" gap={2}>
              <Skeleton height={12} variant="rounded" width="65%" />
              <Skeleton height={20} variant="rounded" width={80} />
            </Box>
            <Skeleton height={20} variant="rounded" width={56} />
          </Box>
        ))}
      </Box>
    </Card>
  );
}

const NeedsAttentionSection: FC<NeedsAttentionSectionProps> = ({
  items,
  isLoading = false,
}) => {
  const { t } = useTranslation();

  if (isLoading) {
    return <NeedsAttentionSectionSkeleton />;
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
            {t('label.needs-attention')}
          </Typography>
          <Typography
            as="div"
            className="tw:text-quaternary tw:mt-0.5"
            size="text-xs">
            {t('label.stale-unused-or-failed-context')}
          </Typography>
        </div>
        <Badge color="warning" size="sm" type="color">
          {String(items.length)}
        </Badge>
      </Box>

      {items.length === 0 ? (
        <Box align="center" className="tw:py-10" justify="center">
          <Typography as="div" className="tw:text-quaternary" size="text-xs">
            {t('message.nothing-needs-attention-right-now')}
          </Typography>
        </Box>
      ) : (
        <div>
          {items.map((item) => (
            <NeedsAttentionRow item={item} key={item.id} />
          ))}
        </div>
      )}
    </Card>
  );
};

export default NeedsAttentionSection;
