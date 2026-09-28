/*
 *  Copyright 2025 Collate.
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
import classNames from 'classnames';
import {
  iconsV2,
  STATUS_TYPE_TO_BADGE_COLOR,
} from '../../../constants/StatusBadge.constant';
import { StatusBadgeProps, StatusType } from './StatusBadge.interface';

const StatusBadgeV2 = ({
  label,
  status,
  dataTestId,
  className,
  externalIcon,
  showIcon = true,
}: StatusBadgeProps) => {
  const StatusIcon = externalIcon ?? iconsV2[status as StatusType];

  return (
    <Badge
      className={classNames(
        'status-badge status-badge-v2 tw:gap-1',
        status,
        className
      )}
      color={STATUS_TYPE_TO_BADGE_COLOR[status] ?? 'gray'}
      data-testid={dataTestId}
      size="sm"
      type="color">
      {showIcon && StatusIcon && <StatusIcon height={14} width={14} />}
      <span className={classNames('status-badge-label', status)}>{label}</span>
    </Badge>
  );
};

export default StatusBadgeV2;
