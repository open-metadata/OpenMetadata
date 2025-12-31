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
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material';
import { Form } from 'antd';
import React, { FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  COLLATE_AUTO_TIER_APP_NAME,
  COLLATE_DATA_QUALITY_APP_NAME,
  COLLATE_DOCUMENTATION_APP_NAME,
} from '../../../constants/Applications.constant';
import { Style } from '../../../generated/type/schema';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { iconTooltipDataRender } from '../../../utils/DomainUtils';
import { MUIColorPicker } from '../../common/ColorPicker';
import MUICoverImageUpload from '../../common/CoverImageUpload/MUICoverImageUpload';
import { DEFAULT_TAG_ICON, MUIIconPicker } from '../../common/IconPicker';
import { StyleModalProps } from '../StyleModal/StyleModal.interface';

const IconColorModal: FC<StyleModalProps> = ({
  open,
  onCancel,
  onSubmit,
  style,
}) => {

  console.log('style', style);
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState<boolean>(false);
  const { applications } = useApplicationStore();

  const selectedColor = Form.useWatch('color', form);

  const isCollateProduct = useMemo(() => {
    return applications.some((app) =>
      [
        COLLATE_DOCUMENTATION_APP_NAME,
        COLLATE_DATA_QUALITY_APP_NAME,
        COLLATE_AUTO_TIER_APP_NAME,
      ].includes(app)
    );
  }, [applications]);

  const handleSubmit = async (values: Style & { coverImage?: unknown }) => {
    try {
      setSaving(true);

      const coverImageValue = values.coverImage as
        | { url?: string; position?: { y?: string } }
        | { file?: File; position?: { y?: string } }
        | undefined;

      const transformedValues: Style = {
        ...values,
        coverImage:
          coverImageValue && ('url' in coverImageValue || 'file' in coverImageValue)
            ? {
              url: 'url' in coverImageValue ? coverImageValue.url : undefined,
              position: coverImageValue.position?.y,
            }
            : undefined,
      };

      await onSubmit(transformedValues);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      slotProps={{
        paper: {
          'data-testid': 'icon-color-modal',
          sx: {
            borderRadius: 1,
            width: 520,
            maxWidth: '100%',
          },
        } as React.HTMLAttributes<HTMLDivElement>,
      }}
      onClose={saving ? undefined : onCancel}>
      <Box data-testid="icon-color-modal-content">
        <DialogTitle
          sx={{
            '&.MuiDialogTitle-root': {
              px: 6,
              py: 4,
            },
          }}>
          {t('label.edit-entity', { entity: t('label.style') })}
        </DialogTitle>
        <DialogContent
          dividers
          sx={{
            '&.MuiDialogContent-root': { p: 6, pb: 0 },
          }}>
          <Form
            form={form}
            id="style-modal-new"
            initialValues={{
              iconURL: style?.iconURL,
              color: style?.color,
              coverImage: style?.coverImage?.url
                ? {
                  url: style.coverImage.url,
                  position: style.coverImage.position
                    ? { y: style.coverImage.position }
                    : undefined,
                }
                : undefined,
            }}
            layout="vertical"
            onFinish={handleSubmit}>
            {isCollateProduct && (
              <Box sx={{ mb: 3 }}>
                <Form.Item
                  name="coverImage"
                  trigger="onChange"
                  valuePropName="value">
                  <MUICoverImageUpload
                    data-testid="cover-image-upload"
                    label={t('label.cover-image')}
                  />
                </Form.Item>
              </Box>
            )}
            <Box sx={{ mb: 3 }}>
              <Form.Item
                name="iconURL"
                trigger="onChange"
                valuePropName="value">
                <MUIIconPicker
                  allowUrl
                  backgroundColor={selectedColor}
                  data-testid="icon-picker-btn"
                  defaultIcon={DEFAULT_TAG_ICON}
                  label={t('label.icon')}
                  placeholder={t('label.icon-url')}
                  toolTip={iconTooltipDataRender()}
                />
              </Form.Item>
            </Box>

            <Box sx={{ mb: 3 }}>
              <Form.Item name="color" trigger="onChange" valuePropName="value">
                <MUIColorPicker label={t('label.color')} />
              </Form.Item>
            </Box>
          </Form>
        </DialogContent>

        <DialogActions
          sx={{
            '&.MuiDialogActions-root': {
              display: 'flex',
              gap: 3,
              px: 6,
              py: 4,
            },
          }}>
          <Button
            data-testid="cancel-button"
            disabled={saving}
            variant="text"
            onClick={onCancel}>
            {t('label.cancel')}
          </Button>
          <Button
            data-testid="save-button"
            disabled={saving}
            form="style-modal-new"
            loading={saving}
            loadingIndicator={<CircularProgress color="inherit" size={16} />}
            type="submit"
            variant="contained"
            onClick={() => form.submit()}>
            {t('label.save')}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};

export default IconColorModal;
