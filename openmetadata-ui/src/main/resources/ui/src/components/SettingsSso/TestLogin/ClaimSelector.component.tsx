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

import {
  Button,
  Dialog,
  Modal,
  ModalOverlay,
} from '@openmetadata/ui-core-components';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClaimSelectorProps, ClaimValue } from './TestLogin.interface';

const formatClaimValue = (value: ClaimValue): string => {
  if (Array.isArray(value)) {
    return value.join(', ');
  }

  return String(value ?? '');
};

const splitEmail = (email: string): { local: string; domain: string } => {
  const at = email.indexOf('@');
  if (at <= 0) {
    return { local: email, domain: '' };
  }

  return { local: email.slice(0, at), domain: email.slice(at + 1) };
};

const ClaimSelector = ({
  open,
  result,
  onConfirm,
  onCancel,
}: ClaimSelectorProps) => {
  const { t } = useTranslation();
  const [selectedClaim, setSelectedClaim] = useState<string>('');

  useEffect(() => {
    if (result) {
      setSelectedClaim(result.suggestedEmailClaim ?? '');
    }
  }, [result]);

  const claimRows = useMemo(() => {
    if (!result) {
      return [];
    }

    return Object.entries(result.claims).map(([name, value]) => ({
      name,
      value: formatClaimValue(value),
    }));
  }, [result]);

  const { adminPrincipal, principalDomain } = useMemo(() => {
    if (!result || !selectedClaim) {
      return { adminPrincipal: '', principalDomain: '' };
    }

    const raw = result.claims[selectedClaim];
    const value = Array.isArray(raw) ? String(raw[0] ?? '') : String(raw ?? '');
    const { local, domain } = splitEmail(value);

    return {
      adminPrincipal: local || result.suggestedAdminPrincipal || '',
      principalDomain: domain || result.derivedPrincipalDomain || '',
    };
  }, [result, selectedClaim]);

  const handleConfirm = () => {
    if (!selectedClaim) {
      return;
    }

    onConfirm({
      emailClaim: selectedClaim,
      principalDomain,
      adminPrincipal,
    });
  };

  return (
    <ModalOverlay
      isDismissable
      isOpen={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onCancel();
        }
      }}>
      <Modal>
        <Dialog
          showCloseButton
          data-testid="sso-claim-selector-modal"
          title={t('label.select-email-claim')}
          width={640}
          onClose={onCancel}>
          <Dialog.Content>
            <p className="tw:text-sm tw:text-tertiary">
              {t('message.claims-received-from-idp')}
            </p>
            <div
              className="sso-claim-selector-rows tw:flex tw:flex-col tw:gap-2"
              data-testid="sso-claim-selector-rows"
              role="radiogroup">
              {claimRows.map((row) => {
                const isSelected = row.name === selectedClaim;

                return (
                  <label
                    className={`sso-claim-selector-row tw:flex tw:items-start tw:gap-3 tw:rounded-md tw:border tw:p-3 tw:cursor-pointer ${
                      isSelected
                        ? 'tw:border-brand tw:bg-brand-secondary'
                        : 'tw:border-secondary'
                    }`}
                    data-testid={`sso-claim-row-${row.name}`}
                    key={row.name}>
                    <input
                      checked={isSelected}
                      className="tw:mt-1"
                      name="sso-email-claim"
                      type="radio"
                      value={row.name}
                      onChange={() => setSelectedClaim(row.name)}
                    />
                    <div className="tw:flex tw:flex-col tw:gap-0.5 tw:flex-1 tw:min-w-0">
                      <code className="tw:text-sm tw:font-medium tw:text-primary">
                        {row.name}
                      </code>
                      <span
                        className="tw:text-xs tw:text-tertiary tw:truncate"
                        title={row.value}>
                        {row.value || '—'}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
            <div
              className="sso-claim-selector-derived tw:rounded-md tw:bg-secondary tw:p-3"
              data-testid="sso-claim-selector-derived">
              <p className="tw:text-sm tw:font-semibold tw:text-primary">
                {t('label.auto-derived-from-selection')}
              </p>
              <dl className="tw:mt-2 tw:grid tw:grid-cols-[max-content_1fr] tw:gap-x-3 tw:gap-y-1 tw:text-xs">
                <dt className="tw:text-tertiary">{t('label.email-claim')}</dt>
                <dd>
                  <code>{selectedClaim || '—'}</code>
                </dd>
                <dt className="tw:text-tertiary">
                  {t('label.admin-principal')}
                </dt>
                <dd>
                  <code>{adminPrincipal || '—'}</code>
                </dd>
                <dt className="tw:text-tertiary">
                  {t('label.principal-domain')}
                </dt>
                <dd>
                  <code>{principalDomain || '—'}</code>
                </dd>
                <dt className="tw:text-tertiary">{t('label.refresh-token')}</dt>
                <dd>
                  {result?.hasRefreshToken
                    ? `✓ ${t('label.received')}`
                    : `⚠ ${t('message.no-refresh-token')}`}
                </dd>
              </dl>
            </div>
          </Dialog.Content>
          <Dialog.Footer>
            <Button color="secondary" size="md" onPress={onCancel}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary"
              data-testid="sso-claim-selector-confirm"
              isDisabled={!selectedClaim}
              size="md"
              onPress={handleConfirm}>
              {t('label.confirm-email-claim')}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default ClaimSelector;
