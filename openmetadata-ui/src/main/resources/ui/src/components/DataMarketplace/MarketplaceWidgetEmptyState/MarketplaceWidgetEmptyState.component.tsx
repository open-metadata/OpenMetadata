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

import { Button, Typography } from '@openmetadata/ui-core-components';
import { Plus } from '@untitledui/icons';
import { ReactNode } from 'react';

export interface MarketplaceWidgetEmptyStateProps {
  actionLabel?: string;
  dataTestId?: string;
  description: string;
  icon: ReactNode;
  onAction?: () => void;
  title: string;
}

const MarketplaceWidgetEmptyState = ({
  actionLabel,
  dataTestId = 'marketplace-widget-empty-state',
  description,
  icon,
  onAction,
  title,
}: MarketplaceWidgetEmptyStateProps) => (
  <div
    className="tw:flex tw:h-full tw:flex-col tw:items-center tw:justify-center tw:py-4 tw:px-6"
    data-testid={dataTestId}>
    <div className="tw:mb-4 tw:grid tw:h-14 tw:w-14 tw:place-items-center tw:rounded-[14px] tw:border tw:border-secondary tw:bg-primary tw:shadow-sm">
      {icon}
    </div>
    <Typography
      className="tw:mb-2 tw:text-center tw:text-text-primary"
      size="text-sm"
      weight="semibold">
      {title}
    </Typography>
    <Typography
      as="p"
      className="tw:m-0 tw:mt-1! tw:max-w-80 tw:text-center tw:text-text-tertiary"
      size="text-xs"
      weight="regular">
      {description}
    </Typography>
    {actionLabel && onAction && (
      <Button
        className="tw:mt-5"
        color="primary"
        data-testid={`${dataTestId}-action`}
        iconLeading={Plus}
        onPress={onAction}>
        {actionLabel}
      </Button>
    )}
  </div>
);

export default MarketplaceWidgetEmptyState;
