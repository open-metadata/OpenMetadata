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
import { PopoverProps } from 'antd';
import { ReactNode } from 'react';
import { EntityReference } from '../../../generated/entity/teams/user';

export type UserSelectableListProps =
  | {
      hasPermission: boolean;
      selectedUsers: EntityReference[];
      children?: ReactNode;
      popoverProps?: PopoverProps;
      filterCurrentUser?: boolean;
    } & (
      | {
          multiSelect?: true;
          onUpdate: (updatedUsers: EntityReference[]) => Promise<void>;
        }
      | {
          multiSelect: false;
          onUpdate: (updatedUsers: EntityReference) => Promise<void>;
        }
    );
