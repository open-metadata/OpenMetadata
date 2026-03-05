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

import { Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { useApplicationStore } from '../../../hooks/useApplicationStore';

const MarketplaceGreetingBanner = () => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();

  const displayName = currentUser?.displayName || currentUser?.name || '';

  return (
    <div className="text-center p-y-lg" data-testid="marketplace-greeting">
      <Typography.Title data-testid="greeting-text" level={4}>
        {t('label.hey-comma-name', { name: displayName })}
        {'\uD83D\uDC4B'}
      </Typography.Title>
      <Typography.Text className="text-grey-muted">
        {t('message.discover-data-products-subtitle')}
      </Typography.Text>
    </div>
  );
};

export default MarketplaceGreetingBanner;
