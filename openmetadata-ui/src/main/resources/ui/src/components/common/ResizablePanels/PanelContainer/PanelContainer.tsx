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
import { Typography } from 'antd';
import classNames from 'classnames';
import React from 'react';
import { PanelContainerProps } from '../ResizablePanels.interface';

const PanelContainer: React.FC<React.PropsWithChildren<PanelContainerProps>> =
  ({ children, className, dimensions, overlay }) => {
    const width = dimensions?.width ?? 0;

    return (
      <div className={classNames(className, 'panel-container')}>
        {overlay && width <= overlay.displayThreshold && (
          <div className="light-overlay">
            <Typography.Title
              className={classNames('rotated-header', {
                'counter-clockwise': overlay?.rotation === 'counter-clockwise',
              })}
              level={2}>
              {overlay.header}
            </Typography.Title>
          </div>
        )}
        {children}
      </div>
    );
  };

export default PanelContainer;
