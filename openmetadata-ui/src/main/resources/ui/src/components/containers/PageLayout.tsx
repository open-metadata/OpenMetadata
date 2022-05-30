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

import { Col, Row } from 'antd';
import classNames from 'classnames';
import React, { FC, Fragment, ReactNode } from 'react';
import { PageLayoutType } from '../../enums/layout.enum';

interface PageLayoutProp {
  leftPanel?: ReactNode;
  header?: ReactNode;
  rightPanel?: ReactNode;
  children: ReactNode;
  layout?: PageLayoutType;
  classes?: string;
}

const PageLayout: FC<PageLayoutProp> = ({
  leftPanel,
  header,
  children,
  rightPanel,
  layout = PageLayoutType['3Col'],
  classes = '',
}: PageLayoutProp) => {
  const getLeftPanel = () => {
    return (
      <Row className="tw-my-4">
        <Col
          className="tw-bg-white tw-px-4 tw-drop-shadow-md tw-rounded-lg"
          offset={1}
          span={22}
          style={{ border: '2px #e0e7ef solid', borderRadius: '8px' }}>
          {leftPanel && <div id="left-panel">{leftPanel}</div>}
        </Col>
      </Row>
    );
  };

  const getRightPanel = () => {
    return (
      rightPanel && (
        <Row className="tw-my-4">
          <Col offset={1} span={22}>
            <div className="tw-py-1" id="right-panel">
              {rightPanel}
            </div>
            <div />
          </Col>
        </Row>
      )
    );
  };

  const get3ColLayout = () => {
    return (
      <Fragment>
        {header && <div className="tw-px-6">{header}</div>}
        <Row>
          <Col span={5}>{getLeftPanel()}</Col>
          <Col span={14}>{children}</Col>
          <Col span={5}>{getRightPanel()}</Col>
        </Row>
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

  return getLayoutByType(layout);
};

export default PageLayout;
