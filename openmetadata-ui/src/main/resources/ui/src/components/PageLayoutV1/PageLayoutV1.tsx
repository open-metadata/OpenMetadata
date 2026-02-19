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
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';
import { styled } from '@mui/material/styles';
import { FULLSCREEN_QUERY_PARAM_KEY } from '../../constants/constants';
import { useAlertStore } from '../../hooks/useAlertStore';
import AlertBar from '../AlertBar/AlertBar';
import DocumentTitle from '../common/DocumentTitle/DocumentTitle';
import './../../styles/layout/page-layout.less';

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
}

export const pageContainerStyles: CSSProperties = {
  marginTop: 0,
  marginBottom: 0,
  marginLeft: 0,
  marginRight: 0,
  overflow: 'hidden',
};

const FullHeightWrapper = styled('div')<{ $wrapperClassName?: string }>(
  ({ $wrapperClassName }) => ({
    [`& .page-layout-v1-vertical-scroll.${$wrapperClassName}`]: {
      overflow: 'hidden',
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
    },
    [`& .${$wrapperClassName} > .ant-row`]: {
      flex: 1,
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
    },
    [`& .${$wrapperClassName} .ant-row .ant-col`]: {
      flex: 'none',
    },
    [`& .${$wrapperClassName} .ant-row .ant-col:last-child`]: {
      minHeight: 0,
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
    },
  })
);

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
}: PageLayoutProp) => {
  const { alert, resetAlert, isErrorTimeOut } = useAlertStore();
  const location = useLocation();
  const [prevPath, setPrevPath] = useState<string | undefined>();

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
        height: 'calc(100vh - 64px)',
        overflow: 'hidden',
        ...pageContainerStyle,
      };
    }

    return pageContainerStyle;
  }, [fullHeight, pageContainerStyle]);

  useEffect(() => {
    if (prevPath !== location.pathname) {
      if (isErrorTimeOut) {
        resetAlert();
      }
    }
  }, [location.pathname, resetAlert, isErrorTimeOut]);

  const isFullScreen = useMemo(() => {
    const queryParams = new URLSearchParams(location.search);

    return queryParams.get(FULLSCREEN_QUERY_PARAM_KEY) === 'true';
  }, [location.search]);

  useEffect(() => {
    setTimeout(() => {
      setPrevPath(location.pathname);
    }, 3000);
  }, [location.pathname]);

  const content = (
    <Fragment>
      <DocumentTitle title={pageTitle} />
      <Row
        className={classNames('p-x-box', className)}
        data-testid="page-layout-v1"
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
            {alert && (
              <Col id="page-alert" span={24}>
                <AlertBar message={alert.message} type={alert.type} />
              </Col>
            )}
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
    <FullHeightWrapper $wrapperClassName={mainContainerClassName}>
      {content}
    </FullHeightWrapper>
  ) : (
    content
  );
};

export default PageLayoutV1;
