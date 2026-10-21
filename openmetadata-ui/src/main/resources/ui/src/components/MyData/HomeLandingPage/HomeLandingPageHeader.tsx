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

import { PageHeader } from '@openmetadata/ui-core-components';
import { startCase } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { getEntityName } from '../../../utils/EntityNameUtils';
import ProfilePicture from '../../common/ProfilePicture/ProfilePicture';
import { getLandingPageHeaderTintStyle } from './landingPageHeaderColor';

export interface HomeLandingPageHeaderProps {
  /** The persona's saved Header Theme colour, laid on as a light wash. */
  headerColor?: string;
}

/**
 * The greeting at the top of the home page. The same PageHeader the Header
 * Theme picker previews, so the colour chosen there is the one shown here.
 */
const HomeLandingPageHeader = ({ headerColor }: HomeLandingPageHeaderProps) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const displayName = getEntityName(currentUser);
  const tintStyle = getLandingPageHeaderTintStyle(headerColor);

  return (
    <PageHeader
      data-testid="home-landing-page-header"
      density="comfortable"
      icon={
        currentUser?.name ? (
          <ProfilePicture
            displayName={displayName}
            name={currentUser.name}
            width="42"
          />
        ) : null
      }
      style={tintStyle}
      subtitle={t('message.home-landing-page-subtitle')}
      title={t('message.hi-user', {
        user: displayName ? startCase(displayName) : t('label.user'),
      })}
      variant={tintStyle ? 'flat' : 'gradient'}
    />
  );
};

export default HomeLandingPageHeader;
