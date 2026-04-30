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
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const DISMISSED_KEY = 'sso-emailClaim-banner-dismissed';

interface EmailClaimRecommendationProps {
  onRunTestLogin: () => void;
  isDisabled?: boolean;
}

const EmailClaimRecommendation = ({
  onRunTestLogin,
  isDisabled = false,
}: EmailClaimRecommendationProps) => {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState<boolean>(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISSED_KEY) === 'true');
  }, []);

  if (dismissed) {
    return null;
  }

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true');
    setDismissed(true);
  };

  return (
    <div
      className="email-claim-recommendation tw:flex tw:items-start tw:gap-3 tw:rounded-md tw:border tw:border-warning tw:bg-warning-secondary tw:p-3"
      data-testid="email-claim-recommendation">
      <div className="tw:flex tw:flex-col tw:gap-1 tw:flex-1">
        <span className="tw:text-sm tw:font-semibold tw:text-primary">
          {t('label.set-explicit-email-claim')}
        </span>
        <span className="tw:text-xs tw:text-tertiary">
          {t('message.email-claim-recommendation-body')}
        </span>
      </div>
      <div className="tw:flex tw:items-center tw:gap-2">
        <Button
          color="primary"
          data-testid="email-claim-recommendation-run"
          isDisabled={isDisabled}
          size="sm"
          onPress={onRunTestLogin}>
          {t('label.run-test-login')}
        </Button>
        <Button
          color="secondary"
          data-testid="email-claim-recommendation-dismiss"
          size="sm"
          onPress={handleDismiss}>
          {t('label.dismiss')}
        </Button>
      </div>
    </div>
  );
};

export default EmailClaimRecommendation;
