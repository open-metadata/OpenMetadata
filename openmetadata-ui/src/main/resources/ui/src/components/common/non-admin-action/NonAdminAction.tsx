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

import { UserPermissions } from 'Models';
import React from 'react';
import { Operation } from '../../../generated/entity/policies/accessControl/rule';
import { useAuth } from '../../../hooks/authHooks';
import PopOver from '../popover/PopOver';

type Props = {
  children: React.ReactNode;
  className?: string;
  title?: string;
  position?: 'top' | 'right' | 'bottom' | 'left';
  isOwner?: boolean;
  html?: React.ReactElement;
  trigger?: 'mouseenter' | 'focus' | 'click' | 'manual';
  permission?: Operation;
};

const NonAdminAction = ({
  children,
  className = '',
  position = 'top',
  title,
  isOwner = false,
  html,
  trigger = 'mouseenter',
  permission,
}: Props) => {
  const { isAuthDisabled, isAdminUser, userPermissions } = useAuth();

  const handleCapturedEvent = (
    e: React.KeyboardEvent | React.MouseEvent
  ): void => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <span className={className}>
      {isAdminUser ||
      isOwner ||
      isAuthDisabled ||
      userPermissions[permission as keyof UserPermissions] ? (
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
