/*
 *  Copyright 2021 Collate
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

import classNames from 'classnames';
import React, { FC, ReactNode } from 'react';

interface PageLayoutProp {
  leftPanel?: ReactNode;
  rightPanel?: ReactNode;
  children: ReactNode;
}

const PageLayout: FC<PageLayoutProp> = ({
  leftPanel,
  children,
  rightPanel,
}: PageLayoutProp) => {
  return (
    <div
      className={classNames(
        'page-layout-container tw-gap-x-3 tw-px-12 tw-overflow-y-auto',
        {
          'page-layout-container-left-center-right':
            leftPanel && children && rightPanel,
        },
        {
          'page-layout-container-left-center': !rightPanel,
        },
        {
          'page-layout-container-center-right': !leftPanel,
        },
        {
          'page-layout-container-center': !leftPanel && !rightPanel,
        }
      )}>
      {leftPanel && (
        <div
          className="tw-overflow-y-auto tw-pl-2 tw-pr-4 tw-py-1"
          id="left-panel">
          {leftPanel}
        </div>
      )}
      <div className="tw-overflow-y-auto tw-py-1 tw-pl-2 tw-pr-4" id="center">
        {children}
      </div>
      {rightPanel && (
        <div className="tw-overflow-y-auto tw-px-2 tw-py-1" id="right-panel">
          {rightPanel}
        </div>
      )}
    </div>
  );
};

export default PageLayout;
