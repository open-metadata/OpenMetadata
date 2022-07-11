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

import { toLower } from 'lodash';
import React, { FC } from 'react';
import UserPopOverCard from '../../../components/common/PopOverCard/UserPopOverCard';
import ProfilePicture from '../../../components/common/ProfilePicture/ProfilePicture';
import { Thread } from '../../../generated/entity/feed/thread';
import { getDayTimeByTimeStamp } from '../../../utils/TimeUtils';

interface ClosedTaskProps {
  task: Thread['task'];
}

const ClosedTask: FC<ClosedTaskProps> = ({ task }) => {
  return (
    <div className="tw-flex" data-testid="task-closed">
      <UserPopOverCard userName={task?.closedBy || ''}>
        <span className="tw-flex">
          <ProfilePicture
            displayName={task?.closedBy}
            id=""
            name={task?.closedBy || ''}
            width="20"
          />
          <span className="tw-font-semibold tw-cursor-pointer hover:tw-underline tw-ml-1">
            {task?.closedBy}
          </span>{' '}
        </span>
      </UserPopOverCard>
      <span className="tw-ml-1"> closed this task </span>
      <span className="tw-ml-1">
        {toLower(getDayTimeByTimeStamp(task?.closedAt as number))}
      </span>
    </div>
  );
};

export default ClosedTask;
