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
import Icon from '@ant-design/icons';
import classNames from 'classnames';
import React from 'react';
import { ReactComponent as DeprecatedIcon } from '../../../assets/svg/arrow-down-colored.svg';
import { ReactComponent as ApprovedIcon } from '../../../assets/svg/check-colored.svg';
import { ReactComponent as DraftIcon } from '../../../assets/svg/clipboard-colored.svg';
import { ReactComponent as InReviewIcon } from '../../../assets/svg/eye-colored.svg';
import { ReactComponent as RejectedIcon } from '../../../assets/svg/x-colored.svg';
import { Status } from '../../../generated/entity/data/glossaryTerm';
import './status-badge.less';
import { StatusBadgeProps } from './StatusBadge.interface';

const icons = {
  [Status.Approved]: ApprovedIcon,
  [Status.Rejected]: RejectedIcon,
  [Status.InReview]: InReviewIcon,
  [Status.Draft]: DraftIcon,
  [Status.Deprecated]: DeprecatedIcon,
} as const;

const StatusBadge = ({ label, status, dataTestId }: StatusBadgeProps) => {
  const StatusIcon = icons[label as Status];

  return (
    <div
      className={classNames('status-badge', status)}
      data-testid={dataTestId}>
      {StatusIcon && <Icon className="text-sm" component={StatusIcon} />}
      <span className={`status-badge-label ${status}`}>{label}</span>
    </div>
  );
};

export default StatusBadge;
