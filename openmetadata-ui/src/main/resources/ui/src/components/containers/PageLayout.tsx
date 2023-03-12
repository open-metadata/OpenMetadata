/*
 *  Copyright 2022 Collate.
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
import DocumentTitle from 'components/DocumentTitle/DocumentTitle';
import React, { FC, Fragment, ReactNode } from 'react';
import { PageLayoutType } from '../../enums/layout.enum';

interface PageLayoutProp {
  leftPanel?: ReactNode;
  header?: ReactNode;
  rightPanel?: ReactNode;
  children: ReactNode;
  layout?: PageLayoutType;
  classes?: string;
  pageTitle: string;
}

/**
 *
 * @deprecated Please use {@link https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/src/components/containers/PageLayoutV1.tsx PageLayoutV1}
 */
const PageLayout: FC<PageLayoutProp> = ({
  leftPanel,
  header,
  children,
  rightPanel,
  layout = PageLayoutType['3Col'],
  pageTitle,
  classes = '',
}: PageLayoutProp) => {
  const getLeftPanel = () => {
    return (
      leftPanel && (
        <div className="tw-py-1" id="left-panel">
          {leftPanel}
        </div>
      )
    );
  };

  const getRightPanel = () => {
    return (
      rightPanel && (
        <div className="tw-py-1" id="right-panel">
          {rightPanel}
        </div>
      )
    );
  };

  const get3ColLayout = () => {
    return (
      <Fragment>
        {header && <div className="tw-px-6">{header}</div>}
        <div
          className={classNames(
            'page-layout-container l3-col tw-gap-x-3 tw-px-6 centered-layout',
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
          {getLeftPanel()}
          <div className={leftPanel || rightPanel ? 'tw-py-1' : ''} id="center">
            {children}
          </div>
          {getRightPanel()}
        </div>
      </Fragment>
    );
  };

  const get2ColLTRLayout = () => {
    return (
      <Fragment>
        {header && <div className="tw-px-6">{header}</div>}
        <div
          className={classNames(
            'page-layout-container l2-ltr-col tw-gap-x-3 tw-px-6 centered-layout',
            classes,
            leftPanel
              ? 'page-layout-container-left-center'
              : 'page-layout-container-center'
          )}>
          {getLeftPanel()}
          <div
            className={classNames('tw-py-1', {
              'tw-pl-8': leftPanel,
            })}
            id="center">
            {children}
          </div>
        </div>
      </Fragment>
    );
  };

  const get2ColRTLLayout = () => {
    return (
      <Fragment>
        {header && (
          <div className="page-layout-container tw-gap-x-3 tw-px-6 centered-layout tw-max-w-full-hd tw-pt-4">
            {header}
          </div>
        )}
        <div
          className={classNames(
            'page-layout-container l2-rtl-col tw-gap-x-3 tw-px-6 centered-layout',
            classes,
            rightPanel
              ? 'page-layout-container-center-right'
              : 'page-layout-container-center'
          )}>
          <div
            className={classNames('tw-py-1', {
              'tw-pr-10': rightPanel,
            })}
            id="center">
            {children}
          </div>
          {getRightPanel()}
        </div>
      </Fragment>
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

  return (
    <Fragment>
      <DocumentTitle title={pageTitle} />
      {getLayoutByType(layout)}
    </Fragment>
  );
};

export default PageLayout;
