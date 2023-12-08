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

import React from 'react';
import UserPopOverCard from '../../../../components/common/PopOverCard/UserPopOverCard';
import { useUserProfile } from '../../../../hooks/user-profile/useUserProfile';
import { getEntityName } from '../../../../utils/EntityUtils';

interface FeedCardHeaderNameProps {
  createdBy: string;
  onTitleClickHandler: (value: string) => void;
}

const FeedCardHeaderName = ({
  createdBy,
  onTitleClickHandler,
}: FeedCardHeaderNameProps) => {
  const [, , user] = useUserProfile({
    permission: true,
    name: createdBy ?? '',
  });

  return (
    <UserPopOverCard userName={createdBy}>
      <span
        className="thread-author cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          onTitleClickHandler(createdBy);
        }}>
        {getEntityName(user)}
      </span>
    </UserPopOverCard>
  );
};

export default FeedCardHeaderName;
