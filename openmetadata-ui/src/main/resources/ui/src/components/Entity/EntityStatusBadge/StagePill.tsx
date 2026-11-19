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
import { ChevronDown } from '@openmetadata/ui-core-components/icons';
import { ReactNode } from 'react';
import {
  IconComponent,
  STATUS_TYPE_TO_BADGE_COLOR,
} from '../../../constants/StatusBadge.constant';
import { StatusType } from '../../common/StatusBadge/StatusBadge.interface';

export interface StagePillProps {
  status: StatusType;
  icon?: IconComponent;
  children: ReactNode;
  dataTestId?: string;
}

/**
 * A stage badge that opens a menu: the stage's colour and icon, with the chevron inside the pill so
 * the badge and its menu read as one control.
 */
export const StagePill = ({
  status,
  icon: Icon,
  children,
  dataTestId,
}: StagePillProps) => (
  <Badge
    className="tw:gap-1"
    color={STATUS_TYPE_TO_BADGE_COLOR[status] ?? 'gray'}
    data-testid={dataTestId}
    size="sm"
    type="color">
    {Icon && <Icon aria-hidden="true" className="tw:size-3.5 tw:shrink-0" />}
    <span className="tw:truncate">{children}</span>
    <ChevronDown aria-hidden="true" className="tw:size-3 tw:shrink-0" />
  </Badge>
);
