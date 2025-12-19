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

import { Box, Button, Drawer, IconButton, Typography } from '@mui/material';
import { XClose } from '@untitledui/icons';
import { FormInstance } from 'antd';
import { isUndefined } from 'lodash';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CreateTag,
  ProviderType,
} from '../../generated/api/classification/createTag';
import { Tag } from '../../generated/entity/classification/tag';
import TagsForm from './TagsForm';

interface TagFormDrawerProps {
  open: boolean;
  editTag?: Tag;
  formRef: FormInstance;
  isTier: boolean;
  isLoading: boolean;
  permissions: {
    createTags: boolean;
    editAll: boolean;
    editDescription: boolean;
    editDisplayName: boolean;
  };
  tagsFormHeader: string;
  onClose: () => void;
  onSubmit: (data: CreateTag) => Promise<void>;
}

const TagFormDrawer: FC<TagFormDrawerProps> = ({
  open,
  editTag,
  formRef,
  isTier,
  isLoading,
  permissions,
  tagsFormHeader,
  onClose,
  onSubmit,
}) => {
  const { t } = useTranslation();

  return (
    <Drawer
      anchor="right"
      data-testid="tag-form-drawer"
      open={open}
      slotProps={{
        paper: {
          sx: { width: 670 },
        },
      }}
      onClose={onClose}>
      {/* Header */}
      <Box
        sx={{
          px: 6,
          py: 5,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
        <Typography data-testid="form-heading" variant="h6">
          {tagsFormHeader}
        </Typography>
        <IconButton
          data-testid="drawer-close-icon"
          size="medium"
          sx={{ color: (theme) => theme.palette.grey[700] }}
          onClick={onClose}>
          <XClose />
        </IconButton>
      </Box>

      {/* Form Content */}
      <Box sx={{ flex: 1, overflow: 'auto', px: 6, py: 4 }}>
        <TagsForm
          formRef={formRef}
          initialValues={editTag}
          isEditing={!isUndefined(editTag)}
          isSystemTag={editTag?.provider === ProviderType.System}
          isTier={isTier}
          key={editTag?.id ?? 'new-tag'}
          permissions={permissions}
          onSubmit={onSubmit}
        />
      </Box>

      {/* Footer */}
      <Box
        sx={{
          px: 6,
          py: 3,
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 2,
        }}>
        <Button
          data-testid="cancel-button"
          variant="outlined"
          onClick={onClose}>
          {t('label.cancel')}
        </Button>
        <Button
          data-testid="save-button"
          disabled={isLoading}
          variant="contained"
          onClick={() => formRef.submit()}>
          {isLoading ? t('label.saving') : t('label.save')}
        </Button>
      </Box>
    </Drawer>
  );
};

export default TagFormDrawer;
