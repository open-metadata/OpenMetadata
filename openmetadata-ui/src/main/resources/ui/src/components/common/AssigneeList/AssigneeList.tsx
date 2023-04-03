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

import { uniqueId } from 'lodash';
import React, { FC, HTMLAttributes } from 'react';
import { useHistory } from 'react-router-dom';
import { getOwnerValue } from 'utils/CommonUtils';
import { EntityReference } from '../../../generated/type/entityReference';
import UserPopOverCard from '../PopOverCard/UserPopOverCard';
import ProfilePicture from '../ProfilePicture/ProfilePicture';

interface Props extends HTMLAttributes<HTMLDivElement> {
  assignees: EntityReference[];
}

const AssigneeList: FC<Props> = ({ assignees, className }) => {
  const history = useHistory();

  const handleClick = (e: React.MouseEvent, assignee: EntityReference) => {
    e.stopPropagation();
    const linkPath = getOwnerValue(assignee);
    history.push(linkPath);
  };

  return (
    <span className={className}>
      {assignees.map((assignee) => (
        <UserPopOverCard
          key={uniqueId()}
          type={assignee.type}
          userName={assignee.name || ''}>
          <span
            className="tw-flex tw-m-1.5 tw-mt-0 tw-cursor-pointer"
            data-testid="assignee"
            onClick={(e) => handleClick(e, assignee)}>
            <ProfilePicture id="" name={assignee.name || ''} width="20" />
            <span className="tw-ml-1">{assignee.name || ''}</span>
          </span>
        </UserPopOverCard>
      ))}
    </span>
  );
};

export default AssigneeList;
