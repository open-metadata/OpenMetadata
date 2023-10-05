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

import { observer } from 'mobx-react';
import React, { useMemo } from 'react';
import AppState from '../../../../AppState';
import UserPopOverCard from '../../../../components/common/PopOverCard/UserPopOverCard';

interface FeedCardHeaderNameProps {
  createdBy: string;
  onTitleClickHandler: (value: string) => void;
}

const FeedCardHeaderName = ({
  createdBy,
  onTitleClickHandler,
}: FeedCardHeaderNameProps) => {
  const userDisplayName = useMemo(() => {
    const userDetails = AppState.getUserDisplayName('', createdBy);

    return userDetails ?? createdBy;
  }, [AppState.userProfilePics, createdBy]);

  return (
    <UserPopOverCard userName={createdBy}>
      <span
        className="thread-author cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          onTitleClickHandler(createdBy);
        }}>
        {userDisplayName}
      </span>
    </UserPopOverCard>
  );
};

export default observer(FeedCardHeaderName);
