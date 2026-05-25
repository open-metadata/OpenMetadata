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

import { Button, Typography } from '@openmetadata/ui-core-components';
import { Check } from '@untitledui/icons';
import { useTranslation } from 'react-i18next';
import { EmailClaimStatusProps } from './TestLogin.interface';

const EmailClaimStatus = ({
  emailClaim,
  onChange,
  isDisabled = false,
}: EmailClaimStatusProps) => {
  const { t } = useTranslation();
  const isSet = Boolean(emailClaim && emailClaim.trim().length > 0);

  return (
    <div
      className="email-claim-status tw:flex tw:items-center tw:gap-3 tw:rounded-md tw:border tw:border-secondary tw:bg-secondary tw:px-3 tw:py-2"
      data-testid="email-claim-status">
      <div className="tw:flex tw:flex-col tw:gap-0.5 tw:flex-1 tw:min-w-0">
        <Typography as="span" className="tw:text-tertiary" size="text-xs">
          {t('label.email-claim')}
        </Typography>
        {isSet ? (
          <Typography
            as="span"
            className="tw:text-primary tw:inline-flex tw:items-center tw:gap-1"
            data-testid="email-claim-status-set"
            size="text-sm"
            weight="medium">
            <code>{emailClaim}</code>
            <Check className="tw:text-fg-success-primary" size={14} />
            <Typography
              as="span"
              className="tw:text-tertiary tw:font-normal"
              size="text-xs">
              {t('message.email-claim-verified')}
            </Typography>
          </Typography>
        ) : (
          <Typography
            as="span"
            className="tw:text-primary"
            data-testid="email-claim-status-not-set"
            size="text-sm">
            {t('message.email-claim-not-set')}
          </Typography>
        )}
      </div>
      <Button
        color="secondary"
        data-testid="email-claim-change-button"
        isDisabled={isDisabled}
        size="sm"
        onPress={onChange}>
        {isSet
          ? t('label.change-via-test-login')
          : t('label.set-via-test-login')}
      </Button>
    </div>
  );
};

export default EmailClaimStatus;
