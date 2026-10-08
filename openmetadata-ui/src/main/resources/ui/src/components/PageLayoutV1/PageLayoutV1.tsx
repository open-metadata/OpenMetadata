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
import { FC, Fragment, HTMLAttributes, ReactNode, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { FULLSCREEN_QUERY_PARAM_KEY } from '../../constants/constants';
import DocumentTitle from '../common/DocumentTitle/DocumentTitle';
import './../../styles/layout/page-layout.less';

export type PageLayoutVariant = 'default' | 'compact';

interface PageLayoutProp extends HTMLAttributes<HTMLDivElement> {
  leftPanel?: ReactNode;
  rightPanel?: ReactNode;
  center?: boolean;
  pageTitle: string;
  mainContainerClassName?: string;
  rightPanelWidth?: number;
  leftPanelWidth?: number;
  fullHeight?: boolean;
  variant?: PageLayoutVariant;
}

const PageLayoutV1: FC<PageLayoutProp> = ({
  leftPanel,
  children,
  rightPanel,
  className,
  pageTitle,
  center = false,
  leftPanelWidth = 230,
  rightPanelWidth = 284,
  mainContainerClassName = '',
  fullHeight = false,
  variant = 'default',
}: PageLayoutProp) => {
  const location = useLocation();

  // `compact` (uniform 8px) is for pages whose header is a core PageLayout.PageHeader —
  // the calling component decides. Everything else gets the default 16px
  // horizontal gutter.
  const paddingClassName = variant === 'compact' ? 'tw:p-2' : 'tw:px-4';

  const contentWidth = useMemo(() => {
    if (leftPanel && rightPanel) {
      return `calc(100% - ${leftPanelWidth + rightPanelWidth}px)`;
    } else if (leftPanel) {
      return `calc(100% - ${leftPanelWidth}px)`;
    } else if (rightPanel) {
      return `calc(100% - ${rightPanelWidth}px)`;
    } else {
      return '100%';
    }
  }, [leftPanel, rightPanel, leftPanelWidth, rightPanelWidth]);

  const isFullScreen = useMemo(() => {
    const queryParams = new URLSearchParams(location.search);

    return queryParams.get(FULLSCREEN_QUERY_PARAM_KEY) === 'true';
  }, [location.search]);

  return (
    <Fragment>
      <DocumentTitle title={pageTitle} />
      <div
        className={classNames(
          'page-layout-v1',
          paddingClassName,
          { 'page-layout-v1-full-height': fullHeight },
          className
        )}
        data-testid="page-layout-v1"
        data-variant={variant}>
        {leftPanel && (
          <div
            className="page-layout-leftpanel"
            id="left-panelV1"
            style={{ flex: `0 0 ${leftPanelWidth}px`, width: leftPanelWidth }}>
            {leftPanel}
          </div>
        )}
        <div
          className={classNames(
            'page-layout-v1-center page-layout-v1-vertical-scroll',
            {
              'flex justify-center': center,
              'full-screen-view': isFullScreen,
            },
            mainContainerClassName
          )}
          style={{ flex: `1 1 ${contentWidth}`, minWidth: 0 }}>
          <div className="page-layout-v1-inner">{children}</div>
        </div>
        {rightPanel && (
          <div
            className="page-layout-rightpanel page-layout-v1-vertical-scroll"
            id="right-panelV1"
            style={{
              flex: `0 0 ${rightPanelWidth}px`,
              width: rightPanelWidth,
            }}>
            {rightPanel}
          </div>
        )}
      </div>
    </Fragment>
  );
};

export default PageLayoutV1;
