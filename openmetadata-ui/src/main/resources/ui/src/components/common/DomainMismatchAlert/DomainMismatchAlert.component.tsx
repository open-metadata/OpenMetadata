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
import { Alert, Button } from '@openmetadata/ui-core-components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_DOMAIN_VALUE } from '../../../constants/constants';
import { EntityReference } from '../../../generated/entity/type';
import { useDomainStore } from '../../../hooks/useDomainStore';
import { useSwitchActiveDomain } from '../../../hooks/useSwitchActiveDomain';
import { isOutsideSelectedDomain } from '../../../utils/DomainFilterUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';

const DISMISSED_KEY_PREFIX = 'domain-mismatch-dismissed:';

const isDismissed = (entityId: string) => {
  try {
    return localStorage.getItem(DISMISSED_KEY_PREFIX + entityId) !== null;
  } catch {
    return false;
  }
};

const rememberDismissed = (entityId: string) => {
  try {
    localStorage.setItem(DISMISSED_KEY_PREFIX + entityId, '1');
  } catch {
    // Storage unavailable (e.g. private window): the alert simply returns next visit.
  }
};

interface DomainMismatchAlertProps {
  entityId: string;
  domains?: EntityReference[];
}

/** Tells the viewer an opened entity sits outside the navbar domain; never hides the page. */
export const DomainMismatchAlert = ({
  entityId,
  domains,
}: DomainMismatchAlertProps) => {
  const { t } = useTranslation();
  const { activeDomain } = useDomainStore();
  const switchActiveDomain = useSwitchActiveDomain();
  const [dismissed, setDismissed] = useState(() => isDismissed(entityId));

  const show =
    !dismissed &&
    isOutsideSelectedDomain(domains, activeDomain, DEFAULT_DOMAIN_VALUE);
  if (!show || !domains) {
    return null;
  }
  const [assetDomain] = domains;

  return (
    <Alert
      closable
      data-testid="domain-mismatch-alert"
      rightContent={
        <Button
          color="secondary"
          data-testid="domain-mismatch-switch"
          size="sm"
          onPress={() => switchActiveDomain(assetDomain)}>
          {t('label.switch-domain')}
        </Button>
      }
      title={t('message.asset-belongs-to-other-domain', {
        domain: getEntityName(assetDomain),
      })}
      variant="brand"
      onClose={() => {
        rememberDismissed(entityId);
        setDismissed(true);
      }}
    />
  );
};
