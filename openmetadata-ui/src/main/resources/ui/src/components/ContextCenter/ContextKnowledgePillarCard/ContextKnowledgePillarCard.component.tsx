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
  Button,
  Card,
  FeaturedIcon,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { ArrowNarrowRight, TrendUp01 } from '@untitledui/icons';
import { FC, useState } from 'react';
import { PILLAR_TONE_TEXT_CLASS } from '../../../constants/ContextCenter.constants';
import {
  ContextKnowledgePillarCardProps,
  PillarRecentItem,
} from './ContextKnowledgePillarCard.interface';

function RecentItem({
  Icon,
  item,
  showDivider,
}: {
  readonly Icon: FC<{ className?: string }>;
  readonly item: PillarRecentItem;
  readonly showDivider: boolean;
}) {
  return (
    <div
      className={`tw:flex tw:items-center tw:gap-2 tw:py-1.5 ${
        showDivider ? 'tw:border-b tw:border-gray-blue-100' : ''
      }`}>
      <Icon className="tw:size-3 tw:text-quaternary tw:shrink-0" />
      <div className="tw:flex tw:items-center tw:justify-between tw:w-full">
        <Typography
          ellipsis
          as="span"
          className="tw:flex-1 tw:min-w-0 tw:text-secondary"
          size="text-xs">
          {item.title}
        </Typography>
        <Typography
          as="span"
          className="tw:text-quaternary tw:font-mono tw:shrink-0"
          size="text-xs">
          {item.meta}
        </Typography>
      </div>
    </div>
  );
}

export const ContextKnowledgePillarCardSkeleton: FC<{
  dataTestId?: string;
}> = ({ dataTestId }) => (
  <Card
    className="tw:p-5 tw:flex tw:flex-col tw:justify-between"
    data-testid={dataTestId}>
    <div>
      <div className="tw:flex tw:items-center tw:gap-2.5 tw:mb-3.5">
        <Skeleton height={36} variant="rounded" width={36} />
        <div className="tw:flex-1 tw:flex tw:flex-col tw:gap-1.5">
          <Skeleton height={14} variant="rounded" width="50%" />
          <Skeleton height={12} variant="rounded" width="75%" />
        </div>
      </div>

      <div className="tw:flex tw:items-baseline tw:gap-2.5 tw:mb-1 tw:mt-1.5">
        <Skeleton height={36} variant="rounded" width={64} />
        <Skeleton height={12} variant="rounded" width={96} />
      </div>

      <div className="tw:mb-4 tw:mt-1">
        <Skeleton height={12} variant="rounded" width={80} />
      </div>

      <div className="tw:flex tw:flex-col tw:border-t tw:border-secondary tw:pt-2.5 tw:gap-0">
        {[0, 1, 2].map((i) => (
          <div
            className={`tw:flex tw:items-center tw:gap-2 tw:py-1.5 ${
              i < 2 ? 'tw:border-b tw:border-gray-blue-100' : ''
            }`}
            key={i}>
            <Skeleton
              className="tw:shrink-0"
              height={12}
              variant="circular"
              width={12}
            />
            <Skeleton className="tw:flex-1" variant="rounded" />
            <Skeleton variant="rounded" width={48} />
          </div>
        ))}
      </div>
    </div>

    <div className="tw:mt-3.5 tw:pt-2.5 tw:border-t tw:border-secondary">
      <Skeleton height={16} variant="rounded" width={80} />
    </div>
  </Card>
);

const ContextKnowledgePillarCard: FC<ContextKnowledgePillarCardProps> = ({
  icon: Icon,
  title,
  subtitle,
  stat,
  statSub,
  statSubSecondary,
  trend,
  tone,
  recent,
  cta,
  isLoading = false,
  onClick,
  dataTestId,
}) => {
  const [hovered, setHovered] = useState(false);
  const statSubLabel = statSubSecondary
    ? `${statSub} · ${statSubSecondary}`
    : statSub;

  if (isLoading) {
    return <ContextKnowledgePillarCardSkeleton dataTestId={dataTestId} />;
  }

  return (
    <Card
      className="tw:cursor-pointer tw:p-5 tw:hover:border-brand-200 tw:flex tw:flex-col tw:justify-between"
      data-testid={dataTestId}
      style={{
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'transform 0.15s, border-color 0.15s',
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>
      <div>
        <div className="tw:flex tw:items-center tw:gap-2.5 tw:mb-3.5">
          <FeaturedIcon
            className="tw:size-9 tw:rounded-lg tw:bg-brand-50"
            color="brand"
            icon={Icon}
            size="sm"
            theme="light"
          />
          <div className="tw:flex-1 tw:min-w-0">
            <Typography
              as="div"
              className="tw:text-primary"
              size="text-sm"
              weight="semibold">
              {title}
            </Typography>
            <Typography as="div" className="tw:text-quaternary" size="text-xs">
              {subtitle}
            </Typography>
          </div>
        </div>

        <div className="tw:flex tw:items-baseline tw:gap-2.5 tw:mb-1 tw:mt-1.5">
          <Typography
            as="span"
            className="tw:text-primary tw:tabular-nums tw:tracking-tight"
            size="display-md"
            weight="bold">
            {stat}
          </Typography>
          <Typography as="span" className="tw:text-quaternary" size="text-xs">
            {statSubLabel}
          </Typography>
        </div>

        <div
          className={`tw:inline-flex tw:items-center tw:gap-1 tw:mb-4 tw:mt-1 ${PILLAR_TONE_TEXT_CLASS[tone]}`}>
          <TrendUp01 className="tw:size-3 tw:stroke-2" />
          <Typography
            as="span"
            className={PILLAR_TONE_TEXT_CLASS[tone]}
            size="text-xs">
            {trend}
          </Typography>
        </div>

        <div className="tw:flex tw:flex-col tw:border-t tw:border-secondary tw:pt-2.5 tw:gap-0">
          {recent.map((item, i) => (
            <RecentItem
              Icon={Icon}
              item={item}
              key={item.title}
              showDivider={i < recent.length - 1}
            />
          ))}
        </div>
      </div>
      <div className="tw:mt-3.5 tw:pt-2.5 tw:border-t tw:border-secondary tw:inline-flex tw:items-center tw:gap-1.5">
        <Button
          color="link-color"
          iconTrailing={ArrowNarrowRight}
          size="xs"
          type="button">
          {cta}
        </Button>
      </div>
    </Card>
  );
};

export default ContextKnowledgePillarCard;
