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
import classNames from 'classnames';
import React from 'react';
import { ReflexContainer, ReflexElement, ReflexSplitter } from 'react-reflex';
import DocumentTitle from '../../../components/DocumentTitle/DocumentTitle';
import PanelContainer from './PanelContainer/PanelContainer';
import './resizable-panels.less';
import { ResizablePanelsProps } from './ResizablePanels.interface';

const ResizablePanels: React.FC<ResizablePanelsProps> = ({
  className,
  orientation = 'vertical',
  firstPanel,
  secondPanel,
  pageTitle,
  hideSecondPanel = false,
}) => {
  return (
    <>
      <DocumentTitle title={pageTitle} />
      <ReflexContainer
        className={classNames(className, 'bg-white')}
        orientation={orientation}
        style={{ height: 'calc(100vh - 64px)' }}>
        <ReflexElement
          propagateDimensions
          className={classNames(firstPanel.className, {
            'full-width': hideSecondPanel,
          })}
          flex={firstPanel.flex}
          minSize={firstPanel.minWidth}
          onStopResize={(args) => {
            firstPanel.onStopResize?.(args.component.props.flex);
          }}>
          <PanelContainer overlay={firstPanel.overlay}>
            {firstPanel.children}
          </PanelContainer>
        </ReflexElement>

        <ReflexSplitter
          className={classNames('splitter', { hidden: hideSecondPanel })}>
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
        </ReflexSplitter>

        <ReflexElement
          propagateDimensions
          className={classNames(secondPanel.className, {
            hidden: hideSecondPanel,
          })}
          flex={secondPanel.flex}
          minSize={secondPanel.minWidth}
          onStopResize={(args) => {
            secondPanel.onStopResize?.(args.component.props.flex);
          }}>
          {!hideSecondPanel && (
            <PanelContainer overlay={secondPanel.overlay}>
              {secondPanel.children}
            </PanelContainer>
          )}
        </ReflexElement>
      </ReflexContainer>
    </>
  );
};

export default ResizablePanels;
