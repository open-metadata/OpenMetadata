/*
 *  Copyright 2025 Collate.
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

import { Box, Tabs } from '@openmetadata/ui-core-components';
import React, { Key, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { UserAssetsKind } from '../UserAssets/UserAssets.utils';
import UserAssetsView from '../UserAssets/UserAssetsView';

/**
 * "My Data & Following": the current user's owned assets (with stat tiles)
 * and the assets they follow, behind a My Data | Following tab strip.
 */
const MyDataPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const [kind, setKind] = useState<UserAssetsKind>('owned');

  return (
    <Box
      className="tw:flex tw:min-h-0 tw:flex-1"
      data-testid="my-data-page"
      direction="col">
      {/* pt-6 / pr-14 keep the tab line and tabs clear of the close button's hover box. */}
      <Box className="tw:shrink-0 tw:px-6 tw:pt-6 tw:pr-14">
        <Tabs
          selectedKey={kind}
          onSelectionChange={(key: Key) => setKind(key as UserAssetsKind)}>
          <Tabs.List data-testid="my-data-tabs" size="sm" type="underline">
            <Tabs.Item id="owned">{t('label.my-data')}</Tabs.Item>
            <Tabs.Item id="following">{t('label.following')}</Tabs.Item>
          </Tabs.List>
        </Tabs>
      </Box>
      <Box className="tw:flex tw:min-h-0 tw:flex-1 tw:p-6" direction="col">
        {currentUser && (
          // Remount per tab so search, filters and selection start fresh.
          <UserAssetsView key={kind} kind={kind} user={currentUser} />
        )}
      </Box>
    </Box>
  );
};

export default MyDataPage;
