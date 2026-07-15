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
  Card,
  EmptyPlaceholder,
  FeaturedIcon,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { FC } from 'react';
import { ContextSimplePillarCardProps } from './ContextSimplePillarCard.interface';

const ContextSimplePillarCard: FC<ContextSimplePillarCardProps> = ({
  title,
  isLoading = false,
  isEmpty = false,
  emptyMessage,
  emptyAction,
  dataTestId,
  children,
  icon: Icon,
}) => {
  return (
    <Card className="tw:h-full tw:flex tw:flex-col" data-testid={dataTestId}>
      <Box
        align="center"
        className="tw:mb-3.5 tw:px-4 tw:py-3  tw:pb-0"
        gap={3}>
        <FeaturedIcon
          className="tw:size-9 tw:rounded-lg tw:bg-brand-50"
          color="brand"
          icon={<Icon className="tw:size-5" />}
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
        </div>
      </Box>

      <div className="tw:relative tw:flex-1 tw:min-h-0 tw:overflow-y-auto">
        {isLoading ? (
          <Box direction="col" gap={2}>
            <Skeleton height="14px" variant="rounded" width="80%" />
            <Skeleton height="14px" variant="rounded" width="60%" />
            <Skeleton height="14px" variant="rounded" width="70%" />
          </Box>
        ) : isEmpty ? (
          <EmptyPlaceholder
            actions={
              emptyAction
                ? [
                    {
                      key: 'empty-action',
                      label: emptyAction.label,
                      color: 'link-color',
                      iconLeading: emptyAction.icon,
                      size: 'xs',
                      onClick: emptyAction.onClick,
                    },
                  ]
                : undefined
            }
            className="tw:justify-start tw:pt-6 tw:[&_:has(>[data-icon='true'])]:!size-12.5 tw:[&_[data-icon='true']]:size-5"
            width={200}
            description={emptyMessage}
            icon={<Icon className="tw:text-fg-brand-primary" />}
            variant="blank"
          />
        ) : (
          children
        )}
      </div>
    </Card>
  );
};

export default ContextSimplePillarCard;
