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
import { useTranslation } from 'react-i18next';
import { useApplicationStore } from '../../../hooks/useApplicationStore';

const MarketplaceGreetingBanner = () => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();

  const displayName = currentUser?.displayName || currentUser?.name || '';

  return (
    <div className="text-center p-b-sm" data-testid="marketplace-greeting">
      <Typography
        as="h3"
        className="tw:mb-1 tw:mt-0"
        data-testid="greeting-text">
        {t('label.hey-comma-name', { name: displayName })}
      </Typography>
      <Typography as="p" className="tw:text-text-tertiary">
        {t('message.discover-data-products-subtitle')}
      </Typography>
    </div>
  );
};

export default MarketplaceGreetingBanner;
