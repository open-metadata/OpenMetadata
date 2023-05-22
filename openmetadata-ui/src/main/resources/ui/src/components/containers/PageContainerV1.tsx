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
import LeftSidebar from 'components/MyData/LeftSidebar/LeftSidebar.component';
import React, { ReactNode } from 'react';
import './page-container.less';

interface PageContainerV1Props {
  children: ReactNode;
  className?: string;
  hideSidebar?: boolean;
}

const PageContainerV1 = ({
  children,
  className = '',
  hideSidebar = false,
}: PageContainerV1Props) => {
  const sidebarWidth = !hideSidebar ? 108 : 0;

  return (
    <div
      className={classNames('page-container-v1 tw-bg-body-main', className)}
      data-testid="container"
      id="page-container-v1">
      <Row
        className={className}
        data-testid="page-container-layout-v1"
        gutter={[16, 16]}>
        {!hideSidebar && (
          <Col className="left-sidebar-col" flex={`${sidebarWidth}px`}>
            <LeftSidebar />
          </Col>
        )}
        <Col
          className="main-content-col"
          flex={`calc(100% - ${sidebarWidth}px)`}>
          {children}
        </Col>
      </Row>
    </div>
  );
};

export default PageContainerV1;
