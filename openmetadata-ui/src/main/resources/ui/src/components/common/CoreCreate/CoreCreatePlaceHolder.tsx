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
import { Button } from '@openmetadata/ui-core-components';
import { Plus } from '@untitledui/icons';
import classNames from 'classnames';
import { ReactNode } from 'react';

export interface CoreCreatePlaceHolderProps {
  buttonId?: string;
  children?: ReactNode;
  className?: string;
  heading?: string;
  icon?: ReactNode;
  permission?: boolean;
  buttonTitle?: string;
  onClick?: () => void;
  contentMaxWidth?: string;
}

const CoreCreatePlaceHolder = ({
  children,
  buttonId,
  className,
  heading,
  icon,
  buttonTitle,
  permission = false,
  onClick,
  contentMaxWidth,
}: CoreCreatePlaceHolderProps) => {
  return (
    <div
      className={classNames(
        className,
        'h-full flex-center border-default border-radius-sm bg-white w-full p-8 tw:pt-0'
      )}
      data-testid="no-data-placeholder">
      <div className="tw:text-center">
        {icon && <div className="m-b-xs">{icon}</div>}
        <div
          className="tw:flex tw:flex-col tw:items-center"
          style={{ maxWidth: contentMaxWidth ?? '16rem' }}>
          {heading && (
            <p className="tw:m-0 tw:text-base tw:text-gray-700">{heading}</p>
          )}
          {children}
          {permission && onClick && (
            <Button
              className="tw:mt-6 tw:min-w-40"
              color="primary"
              data-testid={buttonId}
              iconLeading={Plus}
              size="md"
              onClick={onClick}>
              {buttonTitle}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoreCreatePlaceHolder;
