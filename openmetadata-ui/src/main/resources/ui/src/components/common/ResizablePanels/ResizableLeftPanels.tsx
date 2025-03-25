/*
 *  Copyright 2023 Collate.
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
import { Button, Tooltip } from 'antd';
import classNames from 'classnames';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReflexContainer, ReflexElement, ReflexSplitter } from 'react-reflex';
import { ReactComponent as CollapseIcon } from '../../../assets/svg/ic-collapse.svg';
import DocumentTitle from '../DocumentTitle/DocumentTitle';
import PanelContainer from './PanelContainer/PanelContainer';
import './resizable-panels.less';
import { ResizablePanelsLeftProps } from './ResizablePanels.interface';

const ResizableLeftPanels: React.FC<ResizablePanelsLeftProps> = ({
  className,
  orientation = 'vertical',
  firstPanel,
  secondPanel,
  pageTitle,
  hideFirstPanel = false,
}) => {
  const { t } = useTranslation();
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);

  const handleCollapse = () => {
    setIsLeftPanelCollapsed((prev) => !prev);
  };

  return (
    <>
      {pageTitle && <DocumentTitle title={pageTitle} />}
      <ReflexContainer
        className={classNames(className, 'resizable-panels-layout')}
        orientation={orientation}>
        <ReflexElement
          className={classNames(firstPanel.className, 'resizable-left-panel', {
            hidden: hideFirstPanel,
            'left-panel-collapsed': isLeftPanelCollapsed,
          })}
          data-testid={firstPanel.className}
          flex={isLeftPanelCollapsed ? 0 : firstPanel.flex}
          minSize={isLeftPanelCollapsed ? 0 : firstPanel.minWidth}
          onStopResize={(args) => {
            firstPanel.onStopResize?.(args.component.props.flex);
          }}>
          {!hideFirstPanel && (
            <PanelContainer overlay={firstPanel.overlay}>
              {firstPanel.children}
            </PanelContainer>
          )}
        </ReflexElement>

        <ReflexSplitter
          className={classNames(
            'splitter left-panel-splitter',
            { hidden: hideFirstPanel },
            { collapsed: isLeftPanelCollapsed }
          )}>
          <Tooltip
            placement={isLeftPanelCollapsed ? 'left' : 'top'}
            title={
              isLeftPanelCollapsed ? t('label.expand') : t('label.collapse')
            }>
            <Button
              className={classNames(
                'collapse-button left-panel-collapse-button',
                {
                  collapsed: isLeftPanelCollapsed,
                }
              )}
              data-testid="collapse-button"
              type="ghost"
              onClick={handleCollapse}>
              <CollapseIcon className="collapse-icon" />
            </Button>
          </Tooltip>
          {!isLeftPanelCollapsed && (
            <div
              className={classNames({
                'panel-grabber-vertical': orientation === 'vertical',
                'panel-grabber-horizontal': orientation === 'horizontal',
              })}>
              <div
                className={classNames('handle-icon', {
                  'handle-icon-vertical ': orientation === 'vertical',
                  'handle-icon-horizontal': orientation === 'horizontal',
                })}
              />
            </div>
          )}
        </ReflexSplitter>

        <ReflexElement
          className={classNames(
            secondPanel.className,
            'resizable-second-panel',
            {
              'full-width': hideFirstPanel || isLeftPanelCollapsed,
            }
          )}
          data-testid={secondPanel.className}
          flex={secondPanel.flex}
          minSize={secondPanel.minWidth}
          onStopResize={(args) => {
            secondPanel.onStopResize?.(args.component.props.flex);
          }}>
          <PanelContainer overlay={secondPanel.overlay}>
            {secondPanel.children}
          </PanelContainer>
        </ReflexElement>
      </ReflexContainer>
    </>
  );
};

export default ResizableLeftPanels;
