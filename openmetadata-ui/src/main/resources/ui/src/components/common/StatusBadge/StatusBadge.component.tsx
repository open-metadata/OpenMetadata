/*
 *  Copyright 2023 Collate.
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
  AllStatusTypes,
  icons,
  STATUS_TYPE_TO_BADGE_COLOR,
} from '../../../constants/StatusBadge.constant';
import { StatusBadgeProps } from './StatusBadge.interface';

const StatusBadge = ({
  label,
  status,
  dataTestId,
  className,
}: StatusBadgeProps) => {
  const StatusIcon = label
    ? icons[label as AllStatusTypes] ||
      icons[label.toLowerCase() as AllStatusTypes]
    : undefined;

  return (
    <Badge
      className={classNames('status-badge tw:gap-1', status, className)}
      color={STATUS_TYPE_TO_BADGE_COLOR[status] ?? 'gray'}
      data-testid={dataTestId}
      size="sm"
      type="color">
      {StatusIcon && <StatusIcon height={14} width={14} />}
      <span className={classNames('status-badge-label', status)}>{label}</span>
    </Badge>
  );
};

export default StatusBadge;
