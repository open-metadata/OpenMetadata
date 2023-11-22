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

import { ImageShape } from 'Models';
import React, { FC, HTMLAttributes } from 'react';
import { EntityReference } from '../../../generated/type/entityReference';
import UserPopOverCard from '../PopOverCard/UserPopOverCard';

interface Props extends HTMLAttributes<HTMLDivElement> {
  assignees: EntityReference[];
  profilePicType?: ImageShape;
  showUserName?: boolean;
  profileWidth?: string;
}

const AssigneeList: FC<Props> = ({ assignees, showUserName = true }) => {
  return (
    <div className="d-flex gap-1 flex-wrap">
      {assignees.map((assignee) => (
        <UserPopOverCard
          key={assignee.name}
          showUserName={showUserName}
          type={assignee.type as 'user' | 'team'}
          userName={assignee.name || ''}
        />
      ))}
    </div>
  );
};

export default AssigneeList;
