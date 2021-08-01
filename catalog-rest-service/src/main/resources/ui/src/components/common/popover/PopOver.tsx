import PropTypes from 'prop-types';
import React from 'react';
import { Tooltip } from 'react-tippy';
import 'react-tippy/dist/tippy.css';
import { PopOverProp, Position, Size, Theme, Trigger } from './PopOverTypes';

const PopOver: React.FC<PopOverProp> = ({
  children,
  className = '',
  html,
  position,
  size = 'regular',
  title,
  trigger,
  theme = 'dark',
}): JSX.Element => {
  return (
    <Tooltip
      arrow
      className={className}
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
