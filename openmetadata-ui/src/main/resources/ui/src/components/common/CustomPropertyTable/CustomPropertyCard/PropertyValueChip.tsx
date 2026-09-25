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
import { Badge } from '@openmetadata/ui-core-components';
import { FC, ReactNode } from 'react';

interface PropertyValueChipProps {
  icon?: FC<{ className?: string }>;
  children: ReactNode;
  'data-testid'?: string;
}

/**
 * Design value chip: 26px tall, 16px leading icon. Core BadgeWithIcon fixes its
 * icon at 12px, so the icon is composed into a plain Badge instead.
 */
export const PropertyValueChip = ({
  icon: Icon,
  children,
  'data-testid': dataTestId = 'value',
}: PropertyValueChipProps) => (
  <Badge
    className="tw:max-w-full tw:gap-1.5 tw:whitespace-normal tw:break-all tw:py-[3px] tw:pr-2.5 tw:pl-2 tw:text-left tw:font-normal tw:text-secondary"
    color="gray"
    data-testid={dataTestId}
    size="md"
    type="modern">
    {Icon && (
      <Icon
        aria-hidden
        className="tw:size-4 tw:shrink-0 tw:text-fg-secondary"
      />
    )}
    <span className="tw:min-w-0">{children}</span>
  </Badge>
);
