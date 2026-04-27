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
import {
  Alert,
  Button,
  Dialog,
  Modal,
  ModalOverlay,
} from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EntityType } from '../../../enums/entity.enum';
import { EntityReference } from '../../../generated/type/entityReference';
import { getEntityLinkFromType } from '../../../utils/EntityUtils';
import { getEntityIcon } from '../../../utils/TableUtils';
import { DomainAssetDryRunModalProps } from './DomainAssetDryRunModal.interface';

const DomainAssetDryRunModal = ({
  visible,
  header,
  confirmText,
  warnings,
  warningsTestId = 'dry-run-warnings',
  isLoading,
  onCancel,
  onConfirm,
}: DomainAssetDryRunModalProps) => {
  const { t } = useTranslation();

  return (
    <ModalOverlay
      isDismissable={!isLoading}
      isOpen={visible}
      onOpenChange={(v) => !v && !isLoading && onCancel()}>
      <Modal data-testid="domain-dry-run-modal">
        <Dialog title={header}>
          <Dialog.Content className="tw:gap-4">
            <Alert
              title={t('message.dry-run-side-effects-warning')}
              variant="warning"
            />
            <ul
              className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-3 tw:p-0"
              data-testid={warningsTestId}>
              {warnings.map((response, index) => {
                const ref = response.request as EntityReference | undefined;
                const fqn = ref?.fullyQualifiedName ?? '';
                const entityType = (ref?.type ?? '') as EntityType;
                const link =
                  fqn && entityType
                    ? getEntityLinkFromType(fqn, entityType)
                    : '';

                return (
                  <li
                    className="tw:flex tw:items-start tw:gap-3 tw:rounded-lg tw:border tw:border-secondary tw:bg-secondary tw:p-3"
                    data-testid={`dry-run-warning-${index}`}
                    key={ref?.id ?? index}>
                    {entityType && (
                      <span className="tw:mt-0.5 tw:flex tw:size-5 tw:shrink-0 tw:items-center tw:justify-center tw:text-tertiary">
                        {getEntityIcon(entityType)}
                      </span>
                    )}
                    <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-1">
                      {link ? (
                        <Link
                          className="tw:break-all tw:text-sm tw:font-semibold tw:text-brand-secondary tw:hover:underline"
                          rel="noopener noreferrer"
                          target="_blank"
                          to={link}>
                          {fqn}
                        </Link>
                      ) : (
                        <span className="tw:break-all tw:text-sm tw:font-semibold tw:text-primary">
                          {fqn}
                        </span>
                      )}
                      <p className="tw:m-0 tw:text-sm tw:text-tertiary">
                        {response.message}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Dialog.Content>
          <Dialog.Footer>
            <span
              className="tw:text-sm tw:text-tertiary tw:sm:self-center"
              data-testid="dry-run-affected-count">
              {t('label.asset-affected-count', {
                count: warnings.length,
              })}
            </span>
            <div className="tw:flex tw:flex-col-reverse tw:gap-3 tw:sm:flex-row tw:sm:justify-end">
              <Button
                color="secondary"
                data-testid="cancel"
                isDisabled={isLoading}
                onPress={onCancel}>
                {t('label.cancel')}
              </Button>
              <Button
                showTextWhileLoading
                color="primary"
                data-testid={isLoading ? 'loading-button' : 'save-button'}
                isDisabled={isLoading}
                isLoading={isLoading}
                onPress={onConfirm}>
                {confirmText}
              </Button>
            </div>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default DomainAssetDryRunModal;
