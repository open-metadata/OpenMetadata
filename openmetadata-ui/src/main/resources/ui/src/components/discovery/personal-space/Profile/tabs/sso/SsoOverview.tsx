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

import { Box, Toggle, Typography } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';

interface SsoOverviewProps {
  isSelfSignupEnabled: boolean;
  onSelfSignupChange: (enabled: boolean) => void;
}

const SsoOverview = ({
  isSelfSignupEnabled,
  onSelfSignupChange,
}: SsoOverviewProps) => {
  const { t } = useTranslation();

  return (
    <Box
      align="center"
      className="tw:w-full tw:max-w-[50%] tw:rounded-[10px] tw:border tw:border-secondary tw:bg-primary tw:p-5"
      data-testid="sso-overview"
      direction="row"
      gap={4}
      justify="between">
      <Box direction="col" gap={1}>
        <Typography size="text-md" weight="semibold">
          {t('label.enable-sso')}
        </Typography>
        <Typography className="tw:text-tertiary" size="text-sm">
          {t('message.allow-user-to-login-via-sso')}
        </Typography>
      </Box>
      <Toggle
        aria-label={t('label.enable-sso')}
        data-testid="sso-self-signup-toggle"
        isSelected={isSelfSignupEnabled}
        onChange={onSelfSignupChange}
      />
    </Box>
  );
};

export default SsoOverview;
