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
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
} from '@mui/material';
import { Button } from '@openmetadata/ui-core-components';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DATA_PRODUCT_TYPE_LABEL_KEYS,
  PORTFOLIO_PRIORITY_LABEL_KEYS,
  VISIBILITY_LABEL_KEYS,
} from '../../../constants/DataProduct.constants';
import {
  DataProductType,
  PortfolioPriority,
  Visibility,
} from '../../../generated/api/domains/createDataProduct';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';

export interface DataProductMetadataModalProps {
  open: boolean;
  dataProduct: DataProduct;
  onCancel: () => void;
  onSubmit: (values: {
    dataProductType?: DataProductType;
    visibility?: Visibility;
    portfolioPriority?: PortfolioPriority;
  }) => Promise<void> | void;
}

// MUI Select treats an empty string "" as "no selection" (matches the
// undefined-means-unset semantics of our DataProduct fields).
const NONE = '';

const DataProductMetadataModal = ({
  open,
  dataProduct,
  onCancel,
  onSubmit,
}: DataProductMetadataModalProps) => {
  const { t } = useTranslation();
  const [dataProductType, setDataProductType] = useState<string>(NONE);
  const [visibility, setVisibility] = useState<string>(NONE);
  const [portfolioPriority, setPortfolioPriority] = useState<string>(NONE);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setDataProductType(dataProduct.dataProductType ?? NONE);
      setVisibility(dataProduct.visibility ?? NONE);
      setPortfolioPriority(dataProduct.portfolioPriority ?? NONE);
      setSubmitting(false);
    }
  }, [open, dataProduct]);

  const handleSave = async () => {
    try {
      setSubmitting(true);
      await onSubmit({
        dataProductType: dataProductType
          ? (dataProductType as DataProductType)
          : undefined,
        visibility: visibility ? (visibility as Visibility) : undefined,
        portfolioPriority: portfolioPriority
          ? (portfolioPriority as PortfolioPriority)
          : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      fullWidth
      data-testid="data-product-metadata-modal"
      maxWidth="sm"
      open={open}
      onClose={onCancel}>
      <DialogTitle>
        {t('label.edit-entity', { entity: t('label.data-product') })}
      </DialogTitle>
      <DialogContent>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            pt: 1,
          }}>
          <FormControl fullWidth>
            <InputLabel id="type-label">{t('label.type')}</InputLabel>
            <Select
              data-testid="type-select"
              inputProps={{ 'data-testid': 'type-select-input' }}
              label={t('label.type')}
              labelId="type-label"
              value={dataProductType}
              onChange={(e) => setDataProductType(e.target.value as string)}>
              <MenuItem value={NONE}>
                <em>{t('label.none')}</em>
              </MenuItem>
              {Object.values(DataProductType).map((v) => (
                <MenuItem key={v} value={v}>
                  {t(DATA_PRODUCT_TYPE_LABEL_KEYS[v])}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel id="visibility-label">
              {t('label.visibility')}
            </InputLabel>
            <Select
              data-testid="visibility-select"
              inputProps={{ 'data-testid': 'visibility-select-input' }}
              label={t('label.visibility')}
              labelId="visibility-label"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as string)}>
              <MenuItem value={NONE}>
                <em>{t('label.none')}</em>
              </MenuItem>
              {Object.values(Visibility).map((v) => (
                <MenuItem key={v} value={v}>
                  {t(VISIBILITY_LABEL_KEYS[v])}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel id="priority-label">
              {t('label.portfolio-priority')}
            </InputLabel>
            <Select
              data-testid="priority-select"
              inputProps={{ 'data-testid': 'priority-select-input' }}
              label={t('label.portfolio-priority')}
              labelId="priority-label"
              value={portfolioPriority}
              onChange={(e) => setPortfolioPriority(e.target.value as string)}>
              <MenuItem value={NONE}>
                <em>{t('label.none')}</em>
              </MenuItem>
              {Object.values(PortfolioPriority).map((v) => (
                <MenuItem key={v} value={v}>
                  {t(PORTFOLIO_PRIORITY_LABEL_KEYS[v])}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button
          color="tertiary"
          data-testid="metadata-modal-cancel"
          isDisabled={submitting}
          size="sm"
          onClick={onCancel}>
          {t('label.cancel')}
        </Button>
        <Button
          color="primary"
          data-testid="metadata-modal-save"
          isLoading={submitting}
          size="sm"
          onClick={handleSave}>
          {t('label.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DataProductMetadataModal;
