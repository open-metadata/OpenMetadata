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
import React from 'react';
import { ReflexContainer, ReflexElement, ReflexSplitter } from 'react-reflex';

import classNames from 'classnames';
import DocumentTitle from 'components/DocumentTitle/DocumentTitle';
import PanelContainer from './PanelContainer/PanelContainer';
import { ResizablePanelsProps } from './ResizablePanels.interface';
import './ResizablePanels.less';

export const ResizablePanels: React.FC<ResizablePanelsProps> = ({
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
      <ReflexContainer className={className} orientation={orientation}>
        <ReflexElement
          propagateDimensions
          className={classNames(firstPanel.className, {
            'full-width': hideSecondPanel,
          })}
          minSize={firstPanel.minWidth}>
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
          minSize={secondPanel.minWidth}>
          <PanelContainer overlay={secondPanel.overlay}>
            {secondPanel.children}
          </PanelContainer>
        </ReflexElement>
      </ReflexContainer>
    </>
  );
};
