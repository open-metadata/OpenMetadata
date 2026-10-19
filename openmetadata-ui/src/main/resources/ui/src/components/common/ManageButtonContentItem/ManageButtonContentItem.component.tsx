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

import { Typography } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { MangeButtonItemLabelProps } from './ManageButtonItemLabel.interface';

export const ManageButtonItemLabel = ({
  name,
  icon,
  description,
  id,
  disabled,
}: MangeButtonItemLabelProps) => {
  const Icon = icon;

  return (
    <div
      className={classNames('tw:flex tw:items-start tw:gap-3', {
        'tw:cursor-pointer': !disabled,
        'tw:cursor-not-allowed tw:opacity-50': disabled,
      })}
      data-testid={id}>
      <div
        className="tw:flex tw:shrink-0 tw:self-center tw:text-fg-quaternary"
        data-testid={`${id}-icon`}>
        <Icon width="18px" />
      </div>
      <div
        className="tw:min-w-0 tw:flex-1 tw:text-left"
        data-testid={`${id}-details-container`}>
        <Typography
          as="p"
          className="tw:text-primary"
          data-testid={`${id}-title`}
          size="text-sm"
          weight="medium">
          {name}
        </Typography>
        <Typography
          as="p"
          className="tw:break-words tw:text-tertiary"
          data-testid={`${id}-description`}
          size="text-xs">
          {description}
        </Typography>
      </div>
    </div>
  );
};
