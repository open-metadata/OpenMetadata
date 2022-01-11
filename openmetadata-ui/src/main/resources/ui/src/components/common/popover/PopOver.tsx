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

import PropTypes from 'prop-types';
import React from 'react';
import { Tooltip } from 'react-tippy';
import 'react-tippy/dist/tippy.css';
import { PopOverProp, Position, Size, Theme, Trigger } from './PopOverTypes';

const PopOver: React.FC<PopOverProp> = ({
  arrow = true,
  children,
  className = '',
  delay = 500,
  hideDelay = 0,
  html,
  position,
  size = 'regular',
  title,
  trigger,
  theme = 'dark',
}): JSX.Element => {
  return (
    <Tooltip
      arrow={arrow}
      className={className}
      delay={delay}
      hideDelay={hideDelay}
      html={html}
      position={position}
      size={size}
      theme={theme}
      title={title || ''}
      trigger={trigger}>
      {children}
    </Tooltip>
  );
};

PopOver.propTypes = {
  arrow: PropTypes.bool,
  children: PropTypes.element,
  className: PropTypes.string,
  html: PropTypes.element,
  position: PropTypes.oneOf([
    'top' as Position,
    'bottom' as Position,
    'left' as Position,
    'right' as Position,
  ]).isRequired,
  size: PropTypes.oneOf(['small' as Size, 'regular' as Size, 'big' as Size]),
  theme: PropTypes.oneOf([
    'dark' as Theme,
    'light' as Theme,
    'transparent' as Theme,
  ]),
  title: PropTypes.string,
  trigger: PropTypes.oneOf([
    'mouseenter' as Trigger,
    'focus' as Trigger,
    'click' as Trigger,
    'manual' as Trigger,
  ]).isRequired,
};

export default PopOver;
