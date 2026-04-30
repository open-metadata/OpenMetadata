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

import { Button } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';

interface EmailClaimStatusProps {
  emailClaim?: string;
  onChange: () => void;
  isDisabled?: boolean;
}

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
        <span className="tw:text-xs tw:text-tertiary">
          {t('label.email-claim')}
        </span>
        {isSet ? (
          <span
            className="tw:text-sm tw:font-medium tw:text-primary"
            data-testid="email-claim-status-set">
            <code>{emailClaim}</code>
            {' ✓ '}
            <span className="tw:text-xs tw:text-tertiary tw:font-normal">
              {t('message.email-claim-verified')}
            </span>
          </span>
        ) : (
          <span
            className="tw:text-sm tw:text-primary"
            data-testid="email-claim-status-not-set">
            {t('message.email-claim-not-set')}
          </span>
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
