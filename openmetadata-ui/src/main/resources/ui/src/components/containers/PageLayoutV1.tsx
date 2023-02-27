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
import DocumentTitle from 'components/DocumentTitle/DocumentTitle';
import React, { FC, Fragment, HTMLAttributes, ReactNode } from 'react';
import './../../styles/layout/page-layout.less';

interface PageLayoutProp extends HTMLAttributes<HTMLDivElement> {
  leftPanel?: ReactNode;
  header?: ReactNode;
  rightPanel?: ReactNode;
  center?: boolean;
  pageTitle: string;
}

export const pageContainerStyles = {
  height: '100%',
  padding: '1rem 0.5rem',
  margin: 0,
  overflow: 'hidden',
};

const PageLayoutV1: FC<PageLayoutProp> = ({
  leftPanel,
  children,
  rightPanel,
  className,
  pageTitle,
  center = false,
}: PageLayoutProp) => {
  return (
    <Fragment>
      <DocumentTitle title={pageTitle} />
      <Row
        className={className}
        data-testid="page-layout-v1"
        gutter={[16, 16]}
        style={pageContainerStyles}>
        {leftPanel && (
          <Col
            className="page-layout-v1-vertical-scroll"
            flex="284px"
            id="left-panelV1">
            {leftPanel}
          </Col>
        )}
        <Col
          className={classNames(
            'page-layout-v1-center page-layout-v1-vertical-scroll',
            {
              'flex justify-center': center,
            }
          )}
          flex={
            leftPanel && rightPanel
              ? 'calc(100% - 568px)'
              : leftPanel || rightPanel
              ? 'calc(100% - 284px)'
              : '100%'
          }
          offset={center ? 3 : 0}
          span={center ? 18 : 24}>
          {children}
        </Col>
        {rightPanel && (
          <Col
            className="page-layout-v1-vertical-scroll"
            flex="284px"
            id="right-panelV1">
            {rightPanel}
          </Col>
        )}
      </Row>
    </Fragment>
  );
};

export default PageLayoutV1;
