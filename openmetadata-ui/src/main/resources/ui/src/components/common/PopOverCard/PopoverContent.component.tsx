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

import { isEmpty } from 'lodash';
import React, { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { OwnerType } from '../../../enums/user.enum';
import { useEntityPopoverData } from '../../../hooks/popover/useEntityPopoverData';
import Loader from '../Loader/Loader';
import { PopoverContentProps } from './UserPopOverCard.interface';
import { UserRoles } from './UserRoles.component';
import { UserTeams } from './UserTeams.component';

export const PopoverContent = React.memo(
  ({ userName, type = OwnerType.USER }: PopoverContentProps) => {
    const { t } = useTranslation();
    const { data: user, loading } = useEntityPopoverData(userName, type);

    return (
      <Fragment>
        {loading ? (
          <Loader size="small" />
        ) : (
          <div className="w-40">
            {isEmpty(user) ? (
              <span>{t('message.no-data-available')}</span>
            ) : (
              <Fragment>
                <UserTeams userName={userName} />
                <UserRoles userName={userName} />
              </Fragment>
            )}
          </div>
        )}
      </Fragment>
    );
  }
);
