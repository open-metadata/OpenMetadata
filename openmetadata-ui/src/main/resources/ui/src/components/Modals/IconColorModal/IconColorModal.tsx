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
import { CoverImage, Style } from '../../../generated/type/schema';
import { FieldProp, FieldTypes } from '../../../interface/FormUtils.interface';
import { iconTooltipDataRender } from '../../../utils/DomainUtils';
import { getField } from '../../../utils/formUtils';
import imageClassBase from '../../BlockEditor/Extensions/image/ImageClassBase';
import { MUIColorPicker } from '../../common/ColorPicker';
import { DEFAULT_TAG_ICON, MUIIconPicker } from '../../common/IconPicker';
import { StyleModalProps } from '../StyleModal/StyleModal.interface';


const IconColorModal: FC<StyleModalProps> = ({
  open,
  onCancel,
  onSubmit,
  style,
  includeCoverImage = false,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState<boolean>(false);


  const selectedColor = Form.useWatch('color', form);

  const { onImageUpload } =
    imageClassBase.getBlockEditorAttachmentProps() ?? {};
  const isCoverImageUploadAvailable = !!onImageUpload;

  const coverImageField: FieldProp | null = isCoverImageUploadAvailable && includeCoverImage
    ? {
        name: 'coverImage',
        id: 'root/coverImage',
        label: t('label.cover-image'),
        muiLabel: t('label.cover-image'),
        required: false,
        type: FieldTypes.COVER_IMAGE_UPLOAD_MUI,
        props: {
          'data-testid': 'cover-image',
          maxSizeMB: 5,
          maxDimensions: { width: 800, height: 400 },
          // NO onUpload prop - this makes MUICoverImageUpload store file locally
          // Parent component will handle upload after domain is created
        },
        formItemProps: {
          valuePropName: 'value',
          trigger: 'onChange',
        },
      }
    : null;

  const handleSubmit = async (values: Style & { coverImage?: unknown }) => {
    try {
      setSaving(true);
      console.log(values);

      const coverImageValue = values.coverImage as
        | { url?: string; position?: { y?: string } }
        | { file?: File; position?: { y?: string } }
        | undefined;

      const transformedValues: Style = {
        ...values,
        coverImage:
          coverImageValue && ('url' in coverImageValue || 'file' in coverImageValue)
            ? {
              url: 'file' in coverImageValue ? coverImageValue.file : undefined,
              position: coverImageValue.position?.y,
            } as CoverImage
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
            {coverImageField && <Box sx={{ mb: 3 }}>{getField(coverImageField)}</Box>}
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
