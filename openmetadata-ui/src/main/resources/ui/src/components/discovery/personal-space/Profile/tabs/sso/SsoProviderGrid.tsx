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

import { Box, Card, Typography } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { AuthProvider } from '../../../../../../generated/settings/settings';
import { PROVIDER_OPTIONS } from '../../../../../../utils/SSOUtils';
import SsoProviderIcon from '../../../../../SettingsSso/SsoProviderIcon/SsoProviderIcon';

interface SsoProviderGridProps {
  onSelect: (provider: AuthProvider) => void;
}

/** Provider cards; picking one opens its setup form directly. */
const SsoProviderGrid = ({ onSelect }: SsoProviderGridProps) => {
  const { t } = useTranslation();

  return (
    <Box data-testid="sso-provider-grid" direction="col" gap={4}>
      <Typography
        className="tw:text-secondary"
        size="text-md"
        weight="semibold">
        {t('label.choose-provider')}
      </Typography>
      <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:sm:grid-cols-2 tw:xl:grid-cols-4">
        {PROVIDER_OPTIONS.map((provider) => (
          <Card
            isClickable
            aria-label={provider.label}
            data-testid={`sso-provider-${provider.key}`}
            key={provider.key}
            role="button"
            tabIndex={0}
            variant="muted"
            onClick={() => onSelect(provider.key)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(provider.key);
              }
            }}>
            <Card.Content className="tw:flex tw:items-center tw:gap-4">
              <Box
                align="center"
                className="tw:size-12 tw:shrink-0 tw:rounded-lg tw:border tw:border-secondary tw:bg-surface"
                justify="center">
                <SsoProviderIcon icon={provider.icon} />
              </Box>
              <Typography size="text-md" weight="semibold">
                {provider.label}
              </Typography>
            </Card.Content>
          </Card>
        ))}
      </div>
    </Box>
  );
};

export default SsoProviderGrid;
