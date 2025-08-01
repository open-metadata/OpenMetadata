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

import { Typography } from 'antd';
import classNames from 'classnames';
import { ReactComponent as TagIcon } from '../../../assets/svg/ic-tag-new.svg';
import { ReactComponent as CloseIcon } from '../../../assets/svg/x-colored.svg';
import { DomainTagProps } from './DomainTag.interface';

import './domain-tag.less';

export const DomainTag = ({
  label,
  className = '',
  removable = false,
  onRemove,
  onClick,
  size = 'default',
  'data-testid': dataTestId,
}: DomainTagProps) => {
  const handleRemove = (event: React.MouseEvent<HTMLSpanElement>) => {
    event.stopPropagation();
    onRemove?.();
  };

  const handleClick = () => {
    onClick?.();
  };

  const sizeClasses = {
    small: 'domain-tag-small',
    default: 'domain-tag-default',
    large: 'domain-tag-large',
  };

  return (
    <div
      className={classNames(
        'domain-tag',
        sizeClasses[size],
        {
          'domain-tag-clickable': Boolean(onClick),
          'domain-tag-removable': removable,
        },
        className
      )}
      data-testid={dataTestId || 'domain-tag'}
      onClick={handleClick}>
      <div className="domain-tag-content">
        <TagIcon data-testid="tag-icon" />
        <Typography.Text data-testid="tag-label">{label}</Typography.Text>
      </div>
      {removable && (
        <span
          className="domain-tag-close"
          data-testid="tag-close"
          onClick={handleRemove}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}>
          <CloseIcon className="domain-tag-close-icon" />
        </span>
      )}
    </div>
  );
};

export default DomainTag;
