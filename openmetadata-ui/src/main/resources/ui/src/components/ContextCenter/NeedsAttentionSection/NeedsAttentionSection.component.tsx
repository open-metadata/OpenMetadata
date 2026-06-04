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
    <div className="tw:flex tw:items-start tw:gap-3 tw:py-3 tw:border-b tw:border-secondary last:tw:border-b-0">
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
    </div>
  );
}

function NeedsAttentionSectionSkeleton() {
  return (
    <Card className="tw:p-5">
      <div className="tw:flex tw:items-start tw:justify-between tw:mb-3.5 tw:gap-3">
        <div className="tw:flex tw:flex-col tw:gap-1.5">
          <Skeleton height={14} variant="rounded" width={120} />
          <Skeleton height={12} variant="rounded" width={180} />
        </div>
        <Skeleton height={22} variant="rounded" width={24} />
      </div>
      <div className="tw:flex tw:flex-col">
        {[0, 1, 2, 3].map((i) => (
          <div
            className="tw:flex tw:items-start tw:gap-3 tw:py-3 tw:border-b tw:border-secondary last:tw:border-b-0"
            key={i}>
            <Skeleton height={16} variant="rounded" width={16} />
            <div className="tw:flex-1 tw:flex tw:flex-col tw:gap-1.5">
              <Skeleton height={12} variant="rounded" width="65%" />
              <Skeleton height={20} variant="rounded" width={80} />
            </div>
            <Skeleton height={20} variant="rounded" width={56} />
          </div>
        ))}
      </div>
    </Card>
  );
}

const NeedsAttentionSection: FC<NeedsAttentionSectionProps> = ({ items, isLoading = false }) => {
  const { t } = useTranslation();

  if (isLoading) {
    return <NeedsAttentionSectionSkeleton />;
  }

  return (
    <Card className="tw:p-5">
      <div className="tw:flex tw:items-start tw:justify-between tw:mb-3.5 tw:gap-3">
        <div>
          <Typography
            as="div"
            className="tw:text-primary"
            size="text-sm"
            weight="semibold">
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
      </div>

      {items.length === 0 ? (
        <div className="tw:flex tw:items-center tw:justify-center tw:py-10">
          <Typography as="div" className="tw:text-quaternary" size="text-xs">
            {t('message.nothing-needs-attention-right-now')}
          </Typography>
        </div>
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
