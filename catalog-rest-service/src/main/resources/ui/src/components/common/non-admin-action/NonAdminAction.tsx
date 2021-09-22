import React from 'react';
import { useAuth } from '../../../hooks/authHooks';
import PopOver from '../popover/PopOver';

type Props = {
  children: React.ReactNode;
  title?: string;
  position?: 'top' | 'right' | 'bottom' | 'left';
  isOwner?: boolean;
  html?: React.ReactElement;
  trigger?: 'mouseenter' | 'focus' | 'click' | 'manual';
};

const NonAdminAction = ({
  children,
  position = 'top',
  title,
  isOwner = false,
  html,
  trigger = 'mouseenter',
}: Props) => {
  const { isAuthDisabled, isAdminUser } = useAuth();

  const handleCapturedEvent = (
    e: React.KeyboardEvent | React.MouseEvent
  ): void => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <span>
      {isAdminUser || isOwner || isAuthDisabled ? (
        <span>{children}</span>
      ) : (
        <PopOver
          html={html}
          position={position}
          title={title}
          trigger={trigger}>
          <span className="disable-cta">
            <span
              onClickCapture={handleCapturedEvent}
              onKeyDownCapture={handleCapturedEvent}
              onMouseDownCapture={handleCapturedEvent}>
              {children}
            </span>
          </span>
        </PopOver>
      )}
    </span>
  );
};

export default NonAdminAction;
