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

import { Card, Typography } from '@openmetadata/ui-core-components';
import { ReactNode } from 'react';

interface MarketplaceItemCardProps {
  icon: ReactNode;
  name: string;
  subtitle: string;
  backgroundColor?: string;
  onClick: () => void;
  dataTestId?: string;
}

const MarketplaceItemCard = ({
  icon,
  name,
  subtitle,
  backgroundColor,
  onClick,
  dataTestId,
}: MarketplaceItemCardProps) => {
  return (
    <Card
      isClickable
      className="tw:flex tw:items-center tw:gap-3 tw:p-3 tw:flex-1 tw:min-w-[235px] tw:max-w-[calc((100%-24px)/3)] tw:shadow-xs"
      data-testid={dataTestId}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}>
      <div
        className="tw:flex tw:items-center tw:justify-center tw:w-10 tw:h-10 tw:min-w-10 tw:rounded-lg tw:text-white"
        style={{ backgroundColor: backgroundColor ?? '#E0E7FF' }}>
        <span className="tw:w-6 tw:h-6 tw:flex tw:items-center tw:justify-center">
          {icon}
        </span>
      </div>
      <div className="tw:flex tw:flex-col tw:min-w-0 tw:gap-0.5">
        <Typography
          as="span"
          className="tw:font-semibold tw:text-sm tw:leading-5 tw:text-primary tw:truncate tw:block"
          title={name}>
          {name}
        </Typography>
        <Typography
          as="span"
          className="tw:text-xs tw:leading-[18px] tw:text-tertiary tw:truncate tw:block"
          title={subtitle}>
          {subtitle}
        </Typography>
      </div>
    </Card>
  );
};

export default MarketplaceItemCard;
