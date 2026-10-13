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

import { HTMLAttributes, ReactNode } from 'react';
import { To } from 'react-router-dom';
import { OwnerType } from '../../../enums/user.enum';
import { User } from '../../../generated/entity/teams/user';

export interface UserTeamsProps {
  user: User;
}

export interface UserRolesProps {
  user: User;
}

export interface PopoverContentProps {
  userName: string;
  type: OwnerType;
}

export interface PopoverTitleProps {
  userName: string;
  profilePicture: JSX.Element;
  type: OwnerType;
}

export interface TeamPopoverContentProps {
  teamName: string;
}

export interface TeamPopoverTitleProps {
  teamName: string;
  profilePicture: JSX.Element;
}

export interface UserPopOverCardProps extends HTMLAttributes<HTMLDivElement> {
  userName: string;
  displayName?: ReactNode;
  type?: OwnerType;
  showUserName?: boolean;
  showUserProfile?: boolean;
  profileWidth?: number;
  className?: string;
  /**
   * Overrides the built-in link destination. Defaults to the legacy user/team
   * route; pass a hash location to navigate inside the personal-space modal.
   */
  to?: To;
  /**
   * When set, intercepts the title click (preventing href navigation) and runs
   * this instead. Used inside the personal-space modal where `location.hash`
   * driven navigation is starved by streaming panels, so clicks must call
   * `setHash` synchronously rather than rely on the anchor's href.
   */
  onTitleClick?: () => void;
}
