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

import { Button } from '@openmetadata/ui-core-components';
import { isEmpty } from 'lodash';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { OwnerType } from '../../../enums/user.enum';
import { EntityReference } from '../../../generated/type/entityReference';
import { useEntityPopoverData } from '../../../hooks/popover/useEntityPopoverData';
import { getEntityName } from '../../../utils/EntityNameUtils';
import {
  getTeamAndUserDetailsPath,
  getUserPath,
} from '../../../utils/RouterUtils';
import { PopoverTitleProps } from './UserPopOverCard.interface';

export const PopoverTitle = React.memo(
  ({ userName, profilePicture, type = OwnerType.USER }: PopoverTitleProps) => {
    const navigate = useNavigate();
    const { data: userData } = useEntityPopoverData(userName, type);

    const name = userData?.name ?? '';
    const displayName = getEntityName(userData as unknown as EntityReference);

    return (
      <div className="d-flex items-center gap-2">
        {profilePicture}
        <div className="self-center">
          <Button
            className="text-info p-0"
            color="link-color"
            size="sm"
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.stopPropagation();
              navigate(
                type === OwnerType.TEAM
                  ? getTeamAndUserDetailsPath(name)
                  : getUserPath(name)
              );
            }}>
            <span className="font-medium m-r-xs" data-testid="user-name">
              {displayName}
            </span>
          </Button>
          {displayName === name ? null : (
            <span className="text-grey-muted">{name}</span>
          )}
          {isEmpty(userData) && <span>{userName}</span>}
        </div>
      </div>
    );
  }
);
