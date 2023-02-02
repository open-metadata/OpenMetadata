/*
 *  Copyright 2022 Collate.
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

import { HTMLAttributes } from 'react';
import { Bot } from '../../generated/entity/bot';
import { User } from '../../generated/entity/teams/user';
import { OperationPermission } from '../PermissionProvider/PermissionProvider.interface';
import { UserDetails } from '../Users/Users.interface';

export interface BotsDetailProps extends HTMLAttributes<HTMLDivElement> {
  botUserData: User;
  botData: Bot;
  botPermission: OperationPermission;
  updateBotsDetails: (data: UserDetails) => Promise<void>;
  revokeTokenHandler: () => void;
  onEmailChange: () => void;
  updateUserDetails: (data: UserDetails) => Promise<void>;
}

export interface DescriptionComponentProps {
  botData: Bot;
}

export interface InheritedRolesComponentProps {
  botUserData: User;
}
