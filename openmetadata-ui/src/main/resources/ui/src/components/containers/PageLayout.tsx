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
import { PageLayoutType } from '../../enums/layout.enum';

interface PageLayoutProp {
  leftPanel?: ReactNode;
  rightPanel?: ReactNode;
  children: ReactNode;
  layout?: PageLayoutType;
  classes?: string;
}

const PageLayout: FC<PageLayoutProp> = ({
  leftPanel,
  children,
  rightPanel,
  layout = PageLayoutType['3Col'],
  classes = '',
}: PageLayoutProp) => {
  const get3ColLayout = () => {
    return (
      <div
        className={classNames(
          'page-layout-container l3-col tw-gap-x-3 tw-px-6 tw-overflow-y-auto centered-layout',
          classes,
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
          <div className="tw-overflow-y-auto tw-pr-4 tw-py-1" id="left-panel">
            {leftPanel}
          </div>
        )}
        <div
          className={classNames(
            'tw-overflow-y-auto tw-py-1',
            {
              'tw-pl-2': leftPanel,
            },
            {
              'tw-pr-4': rightPanel,
            }
          )}
          id="center">
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

  const get2ColLTRLayout = () => {
    return (
      <div
        className={classNames(
          'page-layout-container l2-ltr-col tw-gap-x-3 tw-px-6 tw-overflow-y-auto centered-layout',
          classes,
          leftPanel
            ? 'page-layout-container-left-center'
            : 'page-layout-container-center'
        )}>
        {leftPanel && (
          <div className="tw-overflow-y-auto tw-pr-4 tw-py-1" id="left-panel">
            {leftPanel}
          </div>
        )}
        <div
          className={classNames('tw-overflow-y-auto tw-py-1', {
            'tw-pl-8': leftPanel,
          })}
          id="center">
          {children}
        </div>
      </div>
    );
  };

  const get2ColRTLLayout = () => {
    return (
      <div
        className={classNames(
          'page-layout-container l2-rtl-col tw-gap-x-3 tw-px-6 tw-overflow-y-auto centered-layout',
          classes,
          rightPanel
            ? 'page-layout-container-center-right'
            : 'page-layout-container-center'
        )}>
        <div
          className={classNames('tw-overflow-y-auto tw-py-1', {
            'tw-pr-10': rightPanel,
          })}
          id="center">
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

  const getLayoutByType = (type: PageLayoutType) => {
    switch (type) {
      case PageLayoutType['2ColLTR']: {
        return get2ColLTRLayout();
      }
      case PageLayoutType['2ColRTL']: {
        return get2ColRTLLayout();
      }
      case PageLayoutType['3Col']:
      default: {
        return get3ColLayout();
      }
    }
  };

  return getLayoutByType(layout);
};

export default PageLayout;
