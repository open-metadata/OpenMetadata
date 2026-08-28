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
import { OwnerType } from '../../../enums/user.enum';

export interface UserTeamsProps {
  userName: string;
}

export interface UserRolesProps {
  userName: string;
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
}
