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

import { Typography } from '@openmetadata/ui-core-components';
import { startCase } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { getEntityName } from '../../../utils/EntityNameUtils';
import ProfilePicture from '../../common/ProfilePicture/ProfilePicture';

/**
 * Classic mode's greeting at the top of the home page. Styled like AI mode's
 * "Needs you now" heading, which greets the user there instead, so the two
 * modes open the same way.
 */
const HomeLandingPageHeader = () => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const displayName = getEntityName(currentUser);

  return (
    <div
      className="tw:flex tw:items-center tw:gap-3"
      data-testid="home-landing-page-header">
      {currentUser?.name ? (
        <ProfilePicture
          displayName={displayName}
          name={currentUser.name}
          width="40"
        />
      ) : null}
      <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-1">
        <h2 className="tw:m-0 tw:text-md tw:font-semibold tw:text-primary">
          {t('message.hi-user', {
            user: displayName ? startCase(displayName) : t('label.user'),
          })}
        </h2>
        <Typography color="secondary" size="text-xs">
          {t('message.home-landing-page-subtitle')}
        </Typography>
      </div>
    </div>
  );
};

export default HomeLandingPageHeader;
