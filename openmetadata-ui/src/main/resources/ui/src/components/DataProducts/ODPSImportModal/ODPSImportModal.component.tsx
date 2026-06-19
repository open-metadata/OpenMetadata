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
  RadioButton,
  RadioGroup,
  TextArea,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { load as yamlLoad } from 'js-yaml';
import { isNil } from 'lodash';
import { ChangeEvent, useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createOrUpdateDataProductFromODPSYaml,
  importDataProductFromODPSYaml,
  ODPSImportStrategy,
  ODPSValidationResult,
  validateODPSYaml,
} from '../../../rest/dataProductAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { ODPSImportModalProps } from './ODPSImportModal.interface';

const DEFAULT_STRATEGY: ODPSImportStrategy = 'merge';

// The ODPS product name lives at product.details.<lang>.name. Parse the
// document and read that path instead of regex-matching the first `name:`
// key (which can hit an SLA dimension, a tag, etc.). The backend selects the
// `en` details by default, falling back to the first declared language.
const extractOdpsProductName = (yamlContent: string): string | undefined => {
  let name: string | undefined;
  try {
    const doc = yamlLoad(yamlContent) as {
      product?: { details?: Record<string, { name?: string }> };
    };
    const details = doc?.product?.details;
    if (details) {
      const detail = details.en ?? Object.values(details)[0];
      name = detail?.name;
    }
  } catch {
    name = undefined;
  }

  return typeof name === 'string' ? name.trim() : undefined;
};

const ODPSImportModal = ({
  open,
  existingDataProduct,
  domainFqn,
  onClose,
  onSuccess,
}: ODPSImportModalProps) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [yamlContent, setYamlContent] = useState<string>('');
  const [strategy, setStrategy] =
    useState<ODPSImportStrategy>(DEFAULT_STRATEGY);
  const [validation, setValidation] = useState<ODPSValidationResult | null>(
    null
  );
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const resetState = useCallback(() => {
    setYamlContent('');
    setStrategy(DEFAULT_STRATEGY);
    setValidation(null);
    setIsValidating(false);
    setIsImporting(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const text = loadEvent.target?.result;
        if (typeof text === 'string') {
          setYamlContent(text);
          setValidation(null);
        }
      };
      reader.readAsText(file);
    },
    []
  );

  const handleTextChange = useCallback((value: string) => {
    setYamlContent(value);
    setValidation(null);
  }, []);

  const handleValidate = useCallback(async () => {
    if (!yamlContent.trim()) {
      return;
    }
    setIsValidating(true);
    try {
      const result = await validateODPSYaml(yamlContent);
      setValidation(result);
      showSuccessToast(t('message.odps-validation-successful'));
    } catch (err) {
      setValidation({ valid: false });
      showErrorToast(err as AxiosError);
    } finally {
      setIsValidating(false);
    }
  }, [yamlContent, t]);

  const handleImport = useCallback(async () => {
    if (!yamlContent.trim()) {
      return;
    }
    // The ODPS update endpoint identifies the target data product by the
    // `name` field inside the YAML body. When this modal is opened from a
    // specific data product page, a YAML whose name doesn't match would
    // silently overwrite a sibling product. Guard against that here.
    if (existingDataProduct?.name) {
      const yamlName = extractOdpsProductName(yamlContent);
      // The backend exports the ODPS `name` from displayName ?? name
      // (ODPSConverter.buildProductDetails), so an exported YAML round-trips
      // with the product's displayName, while a hand-written YAML may use the
      // internal name. Accept either. Proceed only when the YAML name is
      // present AND matches; a missing/unparseable name is treated as a
      // mismatch (block) rather than a bypass, so a document without a
      // product.details.<lang>.name path can't silently overwrite the product.
      const expectedNames = [
        existingDataProduct.displayName,
        existingDataProduct.name,
      ].filter(Boolean);
      if (!yamlName || !expectedNames.includes(yamlName)) {
        showErrorToast(
          t('message.odps-yaml-name-mismatch', {
            yamlName: yamlName ?? '',
            existingName:
              existingDataProduct.displayName ?? existingDataProduct.name,
          })
        );

        return;
      }
    }
    setIsImporting(true);
    try {
      const imported = isNil(existingDataProduct)
        ? await importDataProductFromODPSYaml(yamlContent, domainFqn)
        : await createOrUpdateDataProductFromODPSYaml(
            yamlContent,
            strategy,
            domainFqn
          );
      showSuccessToast(t('message.odps-import-successful'));
      onSuccess(imported);
      resetState();
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsImporting(false);
    }
  }, [
    yamlContent,
    existingDataProduct,
    domainFqn,
    strategy,
    onSuccess,
    resetState,
    t,
  ]);

  const triggerFilePicker = () => {
    fileInputRef.current?.click();
  };

  return (
    <ModalOverlay
      isDismissable={!isImporting}
      isOpen={open}
      onOpenChange={(isOpen) => !isOpen && !isImporting && handleClose()}>
      <Modal>
        <Dialog
          showCloseButton
          data-testid="odps-import-modal"
          title={t('label.import-entity', {
            entity: t('label.odps-data-product'),
          })}
          width={720}
          onClose={handleClose}>
          <Dialog.Content>
            <div className="tw:flex tw:flex-col tw:gap-4">
              <Typography as="p" size="text-sm">
                {t('message.odps-import-description')}
              </Typography>

              <div>
                {/* Hidden native file input; triggered by the styled
                    core-components Button below. Avoids the AntD Upload widget
                    and keeps the YAML payload entirely in local state. */}
                <input
                  accept=".yaml,.yml"
                  data-testid="odps-yaml-file-input"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  type="file"
                  onChange={handleFileChange}
                />
                <Button
                  color="secondary"
                  data-testid="odps-upload-button"
                  size="sm"
                  onPress={triggerFilePicker}>
                  {t('label.upload-yaml-file')}
                </Button>
              </div>

              <TextArea
                data-testid="odps-yaml-content"
                placeholder={t('message.paste-odps-yaml-here')}
                rows={10}
                value={yamlContent}
                onChange={handleTextChange}
              />

              {existingDataProduct && (
                <RadioGroup
                  value={strategy}
                  onChange={(value) =>
                    setStrategy(value as ODPSImportStrategy)
                  }>
                  <RadioButton
                    data-testid="odps-strategy-merge"
                    label={
                      <span>
                        <strong>{t('label.merge')}</strong>{' '}
                        <Typography as="span" size="text-xs">
                          — {t('message.odps-merge-description')}
                        </Typography>
                      </span>
                    }
                    value="merge"
                  />
                  <RadioButton
                    data-testid="odps-strategy-replace"
                    label={
                      <span>
                        <strong>{t('label.replace')}</strong>{' '}
                        <Typography as="span" size="text-xs">
                          — {t('message.odps-replace-description')}
                        </Typography>
                      </span>
                    }
                    value="replace"
                  />
                </RadioGroup>
              )}

              <div>
                <Button
                  color="secondary"
                  data-testid="odps-validate-button"
                  isDisabled={!yamlContent.trim()}
                  isLoading={isValidating}
                  size="sm"
                  onPress={handleValidate}>
                  {t('label.validate')}
                </Button>
              </div>

              {validation && validation.valid && (
                <Alert title={t('label.valid')} variant="success">
                  {t('message.odps-yaml-valid-description', {
                    version: validation.version ?? '4.1',
                    languages: validation.languages ?? 'en',
                  })}
                </Alert>
              )}
              {validation && validation.valid === false && (
                <Alert title={t('label.invalid')} variant="error">
                  {t('message.odps-yaml-invalid')}
                </Alert>
              )}
            </div>
          </Dialog.Content>
          <Dialog.Footer>
            <div className="tw:col-span-2 tw:flex tw:justify-end tw:gap-3">
              <Button
                color="tertiary"
                data-testid="odps-import-cancel"
                isDisabled={isImporting}
                size="sm"
                onPress={handleClose}>
                {t('label.cancel')}
              </Button>
              <Button
                color="primary"
                data-testid="odps-import-submit"
                isDisabled={!yamlContent.trim()}
                isLoading={isImporting}
                size="sm"
                onPress={handleImport}>
                {t('label.import')}
              </Button>
            </div>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default ODPSImportModal;
