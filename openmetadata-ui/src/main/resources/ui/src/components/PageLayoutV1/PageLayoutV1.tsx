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

import { Col, Row } from 'antd';
import classNames from 'classnames';
import {
  CSSProperties,
  FC,
  Fragment,
  HTMLAttributes,
  ReactNode,
  useMemo,
} from 'react';
import { useLocation } from 'react-router-dom';
import { FULLSCREEN_QUERY_PARAM_KEY } from '../../constants/constants';
import { useIsAiMode } from '../../hooks/useAppMode';
import DocumentTitle from '../common/DocumentTitle/DocumentTitle';
import './../../styles/layout/page-layout.less';

export type PageLayoutVariant = 'default' | 'compact';

interface PageLayoutProp extends HTMLAttributes<HTMLDivElement> {
  leftPanel?: ReactNode;
  rightPanel?: ReactNode;
  center?: boolean;
  pageTitle: string;
  mainContainerClassName?: string;
  pageContainerStyle?: React.CSSProperties;
  rightPanelWidth?: number;
  leftPanelWidth?: number;
  fullHeight?: boolean;
  variant?: PageLayoutVariant;
}

export const pageContainerStyles: CSSProperties = {
  marginTop: 0,
  marginBottom: 0,
  marginLeft: 0,
  marginRight: 0,
  overflow: 'hidden',
};

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
  pageContainerStyle = {},
  fullHeight = false,
  variant,
}: PageLayoutProp) => {
  const location = useLocation();
  const isAiMode = useIsAiMode();

  // AI mode uses a uniform 8px page padding everywhere; classic mode keeps
  // the 20px horizontal gutter. An explicit `variant` prop always wins so a
  // page can opt out of the mode default.
  const resolvedVariant = variant ?? (isAiMode ? 'compact' : 'default');

  const paddingClassName = resolvedVariant === 'compact' ? 'tw:p-2' : 'p-x-box';

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

  const finalPageContainerStyle = useMemo(() => {
    if (fullHeight && !pageContainerStyle.height) {
      return {
        // The shell (classic navbar, AI content pane, …) owns
        // --ant-navbar-height; never hardcode the chrome offset here.
        height: 'calc(100vh - var(--ant-navbar-height))',
        overflow: 'hidden',
        ...pageContainerStyle,
      };
    }

    return pageContainerStyle;
  }, [fullHeight, pageContainerStyle]);

  const isFullScreen = useMemo(() => {
    const queryParams = new URLSearchParams(location.search);

    return queryParams.get(FULLSCREEN_QUERY_PARAM_KEY) === 'true';
  }, [location.search]);

  const content = (
    <Fragment>
      <DocumentTitle title={pageTitle} />
      <Row
        className={classNames(paddingClassName, className)}
        data-testid="page-layout-v1"
        data-variant={resolvedVariant}
        style={{ ...pageContainerStyles, ...finalPageContainerStyle }}
        wrap={false}>
        {leftPanel && (
          <Col
            className="page-layout-leftpanel"
            flex={leftPanelWidth + 'px'}
            id="left-panelV1">
            {leftPanel}
          </Col>
        )}
        <Col
          className={classNames(
            `page-layout-v1-center page-layout-v1-vertical-scroll`,
            {
              'flex justify-center': center,
              'full-screen-view': isFullScreen,
            },
            mainContainerClassName
          )}
          flex={contentWidth}
          offset={center ? 3 : 0}
          span={center ? 18 : 24}>
          <Row>
            <Col span={24}>{children}</Col>
          </Row>
        </Col>
        {rightPanel && (
          <Col
            className="page-layout-rightpanel page-layout-v1-vertical-scroll"
            flex={rightPanelWidth + 'px'}
            id="right-panelV1">
            {rightPanel}
          </Col>
        )}
      </Row>
    </Fragment>
  );

  return fullHeight ? (
    <div className="full-height-wrapper">{content}</div>
  ) : (
    content
  );
};

export default PageLayoutV1;
