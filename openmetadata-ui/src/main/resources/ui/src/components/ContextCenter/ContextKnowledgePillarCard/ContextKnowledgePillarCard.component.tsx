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
  Dot,
  FeaturedIcon,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { ArrowNarrowRight } from '@untitledui/icons';
import classNames from 'classnames';
import { FC, Fragment } from 'react';
import {
  ContextKnowledgePillarCardProps,
  PillarRecentItem,
} from './ContextKnowledgePillarCard.interface';

function RecentItem({
  Icon,
  item,
}: {
  readonly Icon: FC<{ className?: string }>;
  readonly item: PillarRecentItem;
}) {
  return (
    <Box align="center" className="tw:py-1.5" gap={2}>
      {item.icon ? (
        item.icon
      ) : (
        <Icon className="tw:size-3 tw:text-quaternary tw:shrink-0" />
      )}
      <Box
        align="center"
        className="tw:min-w-0 tw:flex-1"
        gap={4}
        justify="between">
        <div className='tw:min-w-40'>
          <Typography
            ellipsis
            className="tw:min-w-0 tw:flex-1 tw:text-secondary"
            size="text-xs"
            weight="medium">
            {item.title}
          </Typography>
        </div>
        <Box align='center' gap={1}>
          {item.meta.map((metaItem, index) => <Fragment key={metaItem}>
            <div className="tw:max-w-20">
              <Typography
                ellipsis
                className="tw:text-quaternary tw:shrink-0 tw:whitespace-nowrap"
                size="text-xs"
              >
                {metaItem}
              </Typography>
            </div>

            {index < item.meta.length - 1 && (
              <Dot className='tw:text-quaternary' size='micro' />
            )}
          </Fragment>)}
        </Box>
      </Box>
    </Box>
  );
}

export const ContextKnowledgePillarCardSkeleton: FC<{
  dataTestId?: string;
}> = ({ dataTestId }) => (
  <Card
    className="tw:p-5 tw:flex tw:flex-col tw:justify-between"
    data-testid={dataTestId}>
    <div>
      <Box align="center" className="tw:mb-3.5" gap={3}>
        <Skeleton height={36} variant="rounded" width={36} />
        <Box className="tw:flex-1" direction="col" gap={2}>
          <Skeleton height={14} variant="rounded" width="50%" />
          <Skeleton height={12} variant="rounded" width="75%" />
        </Box>
      </Box>

      <Box align="baseline" className="tw:mb-1 tw:mt-1.5" gap={3}>
        <Skeleton height={36} variant="rounded" width={64} />
        <Skeleton height={12} variant="rounded" width={96} />
      </Box>

      <div className="tw:mb-4 tw:mt-1">
        <Skeleton height={12} variant="rounded" width={80} />
      </div>

      <Box className="tw:pt-2.5" direction="col">
        {[0, 1, 2].map((i) => (
          <Box align="center" className="tw:py-1.5" gap={2} key={i}>
            <Skeleton
              className="tw:shrink-0"
              height={12}
              variant="circular"
              width={12}
            />
            <Skeleton className="tw:flex-1" height={12} variant="rounded" />
            <Skeleton height={12} variant="rounded" width={48} />
          </Box>
        ))}
      </Box>
    </div>

    <div className="tw:mt-3.5 tw:pt-2.5">
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
  recent,
  cta,
  isLoading = false,
  onClick,
  dataTestId,
}) => {
  const statSubLabel = statSubSecondary
    ? `${statSub} · ${statSubSecondary}`
    : statSub;
  const hasNoData = recent.length === 0;

  if (isLoading) {
    return <ContextKnowledgePillarCardSkeleton dataTestId={dataTestId} />;
  }

  return (
    <Card
      className={classNames(
        "tw:cursor-pointer tw:p-5 tw:flex tw:flex-col tw:justify-between",
        "tw:transition-[border-color,transform] tw:duration-150 tw:hover:border-utility-blue-200 tw:hover:-translate-y-px tw:h-[65vh]"
      )}
      data-testid={dataTestId}
      onClick={onClick}>
      <div>
        <Box align="center" className="tw:mb-3.5" gap={3}>
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
        </Box>

        <Box align="baseline" className="tw:mb-1 tw:mt-1.5" gap={3}>
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
        </Box>

        <Box className="tw:pt-2.5" direction="col">
          {recent.map((item) => (
            <RecentItem Icon={Icon} item={item} key={item.title} />
          ))}
        </Box>
      </div>
      <Box inline align="center" className="tw:mt-3.5 tw:pt-2.5" gap={2}>
        <Button
          color="link-color"
          iconTrailing={ArrowNarrowRight}
          isDisabled={hasNoData}
          size="xs"
          type="button"
          onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
            e.stopPropagation();
            onClick();
          }}>
          {cta}
        </Button>
      </Box>
    </Card>
  );
};

export default ContextKnowledgePillarCard;
