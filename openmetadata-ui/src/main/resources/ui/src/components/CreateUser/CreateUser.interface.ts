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

import { LoadingState } from 'Models';
import { CreateUser } from '../../generated/api/teams/createUser';
import { Role } from '../../generated/entity/teams/role';
import { EntityReference as UserTeams } from '../../generated/entity/teams/user';

export interface CreateUserProps {
  allowAccess: boolean;
  saveState?: LoadingState;
  roles: Array<Role>;
  teams: Array<UserTeams>;
  onSave: (data: CreateUser) => void;
  onCancel: () => void;
}
