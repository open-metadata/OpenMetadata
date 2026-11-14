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
import { Badge, Typography } from '@openmetadata/ui-core-components';
import type { ReactNode } from 'react';
import RailPager, { type RailPagerProps } from './RailPager';

export interface RailSectionHeaderProps extends RailPagerProps {
  title: string;
  count: number;
  /** Trailing control after the pager, such as "View all". */
  action?: ReactNode;
}

/**
 * The heading row over a Home page rail: its title and live count, then the
 * pager — shown only when there is more than one item to page through.
 */
const RailSectionHeader = ({
  title,
  count,
  action,
  ...pagerProps
}: RailSectionHeaderProps) => (
  <div className="tw:flex tw:items-center tw:gap-2">
    <Typography size="text-sm" weight="semibold">
      {title}
    </Typography>
    <Badge className="tw:rounded-md" color="gray-blue" size="sm" type="color">
      {count}
    </Badge>

    {/* The parent's gap holds the action clear of the pager. */}
    <div className="tw:ml-auto tw:flex tw:items-center tw:gap-4">
      {count > 1 && <RailPager {...pagerProps} />}
      {action}
    </div>
  </div>
);

export default RailSectionHeader;
