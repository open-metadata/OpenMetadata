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
import { Button, Typography } from '@openmetadata/ui-core-components';
import { Plus } from '@untitledui/icons';
import classNames from 'classnames';
import { ReactNode } from 'react';

export interface CoreCreateErrorPlaceHolderProps {
  buttonId?: string;
  children?: ReactNode;
  className?: string;
  heading?: string;
  icon?: ReactNode;
  permission?: boolean;
  buttonTitle?: string;
  onClick?: () => void;
  contentMaxWidthClass?: string;
}

const CoreCreateErrorPlaceHolder = ({
  children,
  buttonId,
  className,
  heading,
  icon,
  buttonTitle,
  permission = false,
  onClick,
  contentMaxWidthClass = 'tw:max-w-64',
}: CoreCreateErrorPlaceHolderProps) => {
  return (
    <div
      className={classNames(
        className,
        'tw:h-full tw:flex-center tw:border-default tw:border-radius-sm tw:bg-white tw:w-full tw:p-8 tw:pt-0'
      )}
      data-testid="no-data-placeholder">
      <div className="tw:flex tw:flex-col tw:items-center">
        {icon && <div className="m-b-xs">{icon}</div>}
        <div
          className={classNames(
            'tw:flex tw:items-center tw:flex-col',
            contentMaxWidthClass
          )}>
          {heading && (
            <Typography
              as="h5"
              className="tw:text-gray-900 tw:text-center"
              size="text-md">
              {heading}
            </Typography>
          )}
          {children}
          {permission && onClick && (
            <Button
              className="tw:mt-3 tw:min-w-40"
              color="primary"
              data-testid={buttonId}
              iconLeading={Plus}
              onPress={onClick}>
              {buttonTitle}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoreCreateErrorPlaceHolder;
