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

import { Box, Button } from '@openmetadata/ui-core-components';
import { Database01, Eye } from '@openmetadata/ui-core-components/icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../../constants/constants';
import { User } from '../../../../generated/entity/teams/user';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { getUserFirstName } from '../../../../utils/UsersPureUtils';
import NoDataPlaceholder from '../../../common/EmptyPlaceholder/NoDataPlaceholder';
import { EMPTY_STATE_COPY } from './UserAssets.constants';
import { UserAssetsKind } from './UserAssets.utils';

const UserAssetsEmpty: React.FC<{ kind: UserAssetsKind; user: User }> = ({
  kind,
  user,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useApplicationStore();
  const isSelf = currentUser?.id === user.id;
  const [titleKey, descriptionKey] =
    EMPTY_STATE_COPY[kind][isSelf ? 'self' : 'other'];
  const name = getUserFirstName(user);

  return (
    <Box
      className="tw:relative tw:min-h-80 tw:flex-1"
      data-testid="user-assets-empty">
      <NoDataPlaceholder
        description={t(descriptionKey, { name })}
        footer={
          kind === 'following' && isSelf ? (
            <Button
              color="secondary"
              size="sm"
              onClick={() => navigate(ROUTES.EXPLORE)}>
              {t('label.explore-assets')}
            </Button>
          ) : undefined
        }
        icon={kind === 'owned' ? <Database01 /> : <Eye />}
        title={t(titleKey, { name })}
      />
    </Box>
  );
};

export default UserAssetsEmpty;
