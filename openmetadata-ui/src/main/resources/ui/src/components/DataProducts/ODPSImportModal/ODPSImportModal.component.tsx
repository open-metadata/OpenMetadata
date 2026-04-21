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
  Input,
  Modal,
  Radio,
  Space,
  Typography,
  Upload,
} from 'antd';
import { AxiosError } from 'axios';
import { isNil } from 'lodash';
import { ChangeEvent, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import {
  createOrUpdateDataProductFromODPSYaml,
  importDataProductFromODPSYaml,
  ODPSImportStrategy,
  ODPSValidationResult,
  validateODPSYaml,
} from '../../../rest/dataProductAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';

export interface ODPSImportModalProps {
  open: boolean;
  existingDataProduct?: DataProduct | null;
  domainFqn?: string;
  onClose: () => void;
  onSuccess: (dataProduct: DataProduct) => void;
}

const DEFAULT_STRATEGY: ODPSImportStrategy = 'merge';

const ODPSImportModal = ({
  open,
  existingDataProduct,
  domainFqn,
  onClose,
  onSuccess,
}: ODPSImportModalProps) => {
  const { t } = useTranslation();
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
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  const handleFileUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        setYamlContent(text);
        setValidation(null);
      }
    };
    reader.readAsText(file);

    return false;
  }, []);

  const handleTextChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      setYamlContent(event.target.value);
      setValidation(null);
    },
    []
  );

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

  return (
    <Modal
      destroyOnClose
      cancelText={t('label.cancel')}
      data-testid="odps-import-modal"
      okButtonProps={{
        disabled: !yamlContent.trim(),
        loading: isImporting,
      }}
      okText={t('label.import')}
      open={open}
      title={t('label.import-entity', { entity: t('label.odps-data-product') })}
      width={720}
      onCancel={handleClose}
      onOk={handleImport}>
      <Space className="tw:w-full" direction="vertical" size="middle">
        <Typography.Text>
          {t('message.odps-import-description')}
        </Typography.Text>

        <Upload
          accept=".yaml,.yml"
          beforeUpload={handleFileUpload}
          maxCount={1}
          showUploadList={false}>
          <Button>{t('label.upload-yaml-file')}</Button>
        </Upload>

        <Input.TextArea
          autoSize={{ minRows: 10, maxRows: 20 }}
          data-testid="odps-yaml-content"
          placeholder={t('message.paste-odps-yaml-here')}
          value={yamlContent}
          onChange={handleTextChange}
        />

        {existingDataProduct && (
          <Radio.Group
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as ODPSImportStrategy)}>
            <Space direction="vertical">
              <Radio value="merge">
                <strong>{t('label.merge')}</strong>{' '}
                <Typography.Text type="secondary">
                  — {t('message.odps-merge-description')}
                </Typography.Text>
              </Radio>
              <Radio value="replace">
                <strong>{t('label.replace')}</strong>{' '}
                <Typography.Text type="secondary">
                  — {t('message.odps-replace-description')}
                </Typography.Text>
              </Radio>
            </Space>
          </Radio.Group>
        )}

        <Space>
          <Button
            data-testid="odps-validate-button"
            disabled={!yamlContent.trim()}
            loading={isValidating}
            onClick={handleValidate}>
            {t('label.validate')}
          </Button>
        </Space>

        {validation && validation.valid && (
          <Alert
            showIcon
            description={t('message.odps-yaml-valid-description', {
              version: validation.version ?? '4.1',
              languages: validation.languages ?? 'en',
            })}
            message={t('label.valid')}
            type="success"
          />
        )}
        {validation && validation.valid === false && (
          <Alert
            showIcon
            message={t('message.odps-yaml-invalid')}
            type="error"
          />
        )}
      </Space>
    </Modal>
  );
};

export default ODPSImportModal;
