/*
 *  Copyright 2026 Collate.
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
import { Card, Typography } from 'antd';
import classNames from 'classnames';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { ReflexContainer, ReflexElement, ReflexSplitter } from 'react-reflex';
import DocumentTitle from '../../../components/common/DocumentTitle/DocumentTitle';
import '../../../components/common/ResizablePanels/resizable-panels.less';
import './knowledge-center-layout.less';

interface KnowledgeCenterLayoutProps {
  children: React.ReactNode;
  leftSidebar: React.ReactNode;
  rightSidebar: React.ReactNode;
  pageTitle: string;
  className?: string;
  leftSidebarTitle?: React.ReactNode;
  rightSidebarTitle?: string;
  leftSidebarExtra?: React.ReactNode;
  rightSidebarExtra?: React.ReactNode;
  centerNoPadding?: boolean;
}

const KnowledgeCenterLayout: FC<KnowledgeCenterLayoutProps> = ({
  children,
  leftSidebar,
  rightSidebar,
  pageTitle,
  className,
  leftSidebarTitle,
  rightSidebarTitle,
  leftSidebarExtra,
  rightSidebarExtra,
  centerNoPadding = false,
}) => {
  const { i18n } = useTranslation();
  const isLeftPanelCollapsed = !leftSidebar;
  const isRightPanelCollapsed = !rightSidebar;

  return (
    <div
      className="tw:pb-4"
      dir={i18n.dir()}
      id="knowledge-center-layout-container">
      <DocumentTitle title={pageTitle} />
      <ReflexContainer
        className={classNames('knowledge-center-layout', className)}
        orientation="vertical">
        {/* left */}
        <ReflexElement
          propagateDimensions
          className={classNames('left-panel', {
            'left-panel-collapsed': isLeftPanelCollapsed,
          })}
          data-testid="left-panel"
          flex={0.2}
          minSize={280}>
          <Card
            className="reflex-card left-reflex-card"
            extra={leftSidebarExtra}
            title={
              leftSidebarTitle && (
                <Typography.Text strong className="m-b-0 text-sm">
                  {leftSidebarTitle}
                </Typography.Text>
              )
            }>
            {leftSidebar}
          </Card>
        </ReflexElement>

        <ReflexSplitter
          className={classNames('splitter left-panel-splitter', {
            hidden: isLeftPanelCollapsed,
          })}>
          {!isLeftPanelCollapsed && (
            <div className="panel-grabber-vertical">
              <div className="handle-icon handle-icon-vertical" />
            </div>
          )}
        </ReflexSplitter>

        {/* middle */}
        <ReflexElement
          propagateDimensions
          className={classNames('center-panel', {
            'has-sidebar': !isLeftPanelCollapsed,
          })}
          data-testid="center-panel"
          flex={isRightPanelCollapsed ? 0.8 : 0.6}
          minSize={700}>
          <Card
            bodyStyle={centerNoPadding ? { padding: 0 } : undefined}
            className="reflex-card center-reflex-card">
            {children}
          </Card>
        </ReflexElement>

        <ReflexSplitter
          className={classNames('splitter right-panel-splitter', {
            hidden: isRightPanelCollapsed,
          })}>
          {!isRightPanelCollapsed && (
            <div className="panel-grabber-vertical">
              <div className="handle-icon handle-icon-vertical" />
            </div>
          )}
        </ReflexSplitter>

        <ReflexElement
          propagateDimensions
          className={classNames('right-panel', {
            'right-panel-collapsed': isRightPanelCollapsed,
          })}
          data-testid="right-panel"
          flex={isRightPanelCollapsed ? 0 : 0.2}
          minSize={280}
          style={isRightPanelCollapsed ? { display: 'none' } : {}}>
          <Card
            className="reflex-card right-reflex-card"
            extra={rightSidebarExtra}
            title={
              rightSidebarTitle && (
                <Typography.Text strong className="m-b-0 text-sm">
                  {rightSidebarTitle}
                </Typography.Text>
              )
            }>
            {rightSidebar}
          </Card>
        </ReflexElement>
      </ReflexContainer>
    </div>
  );
};

export default KnowledgeCenterLayout;
