/*
 *  Copyright 2024 Collate.
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

import { SlideoutMenu } from '@openmetadata/ui-core-components';
import { ReactNode, useMemo } from 'react';

export interface DrawerHeaderConfig {
  title?: string | ReactNode;
  showCloseButton?: boolean;
  onClose?: () => void;
  actions?: ReactNode;
}

export const useDrawerHeader = (config: DrawerHeaderConfig = {}) => {
  const { title, showCloseButton = true, onClose, actions } = config;

  const drawerHeader = useMemo(
    () => (
      <SlideoutMenu.Header onClose={showCloseButton ? onClose : undefined}>
        <div className="tw:flex tw:items-center tw:gap-2 tw:flex-1">
          {typeof title === 'string' ? (
            <h6
              className="tw:text-lg tw:font-semibold"
              data-testid="form-heading">
              {title}
            </h6>
          ) : (
            title
          )}
        </div>
        {actions && (
          <div className="tw:flex tw:items-center tw:gap-1">{actions}</div>
        )}
      </SlideoutMenu.Header>
    ),
    [title, showCloseButton, onClose, actions]
  );

  return {
    drawerHeader,
  };
};
