import React from 'react';
import { useAuth } from '../../../hooks/authHooks';
import PopOver from '../popover/PopOver';

type Props = {
  children: React.ReactNode;
  title: string;
  position?: 'top' | 'right' | 'bottom' | 'left';
  isOwner?: boolean;
};

const NonAdminAction = ({
  children,
  position = 'top',
  title,
  isOwner = false,
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
        <PopOver position={position} title={title} trigger="mouseenter">
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
