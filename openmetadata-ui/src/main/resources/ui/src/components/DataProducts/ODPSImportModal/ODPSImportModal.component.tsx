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
  AlertTitle,
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import { Button } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { isNil } from 'lodash';
import { ChangeEvent, useCallback, useRef, useState } from 'react';
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

  const handleTextChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
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

  const triggerFilePicker = () => {
    fileInputRef.current?.click();
  };

  return (
    <Dialog
      fullWidth
      data-testid="odps-import-modal"
      maxWidth="md"
      open={open}
      onClose={handleClose}>
      <DialogTitle>
        {t('label.import-entity', { entity: t('label.odps-data-product') })}
      </DialogTitle>
      <DialogContent>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            pt: 1,
          }}>
          <Typography variant="body2">
            {t('message.odps-import-description')}
          </Typography>

          <Box>
            {/* Hidden native file input; triggered by the styled core-components
                Button above. Avoids the AntD Upload widget and keeps the YAML
                payload entirely in local state. */}
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
              onClick={triggerFilePicker}>
              {t('label.upload-yaml-file')}
            </Button>
          </Box>

          <TextField
            fullWidth
            multiline
            InputProps={{
              inputProps: { 'data-testid': 'odps-yaml-content' },
            }}
            maxRows={20}
            minRows={10}
            placeholder={t('message.paste-odps-yaml-here')}
            value={yamlContent}
            onChange={handleTextChange}
          />

          {existingDataProduct && (
            <RadioGroup
              value={strategy}
              onChange={(e) =>
                setStrategy(e.target.value as ODPSImportStrategy)
              }>
              <FormControlLabel
                control={<Radio data-testid="odps-strategy-merge" />}
                label={
                  <Typography variant="body2">
                    <strong>{t('label.merge')}</strong>{' '}
                    <Typography component="span" variant="caption">
                      — {t('message.odps-merge-description')}
                    </Typography>
                  </Typography>
                }
                value="merge"
              />
              <FormControlLabel
                control={<Radio data-testid="odps-strategy-replace" />}
                label={
                  <Typography variant="body2">
                    <strong>{t('label.replace')}</strong>{' '}
                    <Typography component="span" variant="caption">
                      — {t('message.odps-replace-description')}
                    </Typography>
                  </Typography>
                }
                value="replace"
              />
            </RadioGroup>
          )}

          <Box>
            <Button
              color="secondary"
              data-testid="odps-validate-button"
              isDisabled={!yamlContent.trim()}
              isLoading={isValidating}
              size="sm"
              onClick={handleValidate}>
              {t('label.validate')}
            </Button>
          </Box>

          {validation && validation.valid && (
            <Alert severity="success">
              <AlertTitle>{t('label.valid')}</AlertTitle>
              {t('message.odps-yaml-valid-description', {
                version: validation.version ?? '4.1',
                languages: validation.languages ?? 'en',
              })}
            </Alert>
          )}
          {validation && validation.valid === false && (
            <Alert severity="error">{t('message.odps-yaml-invalid')}</Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button
          color="tertiary"
          data-testid="odps-import-cancel"
          isDisabled={isImporting}
          size="sm"
          onClick={handleClose}>
          {t('label.cancel')}
        </Button>
        <Button
          color="primary"
          data-testid="odps-import-submit"
          isDisabled={!yamlContent.trim()}
          isLoading={isImporting}
          size="sm"
          onClick={handleImport}>
          {t('label.import')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ODPSImportModal;
