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
  SlideoutMenu,
  Typography,
} from '@openmetadata/ui-core-components';
import { isUndefined } from 'lodash';
import { FC, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ProviderType } from '../../generated/api/classification/createTag';
import TagsForm from './TagsForm';
import { TagFormDrawerProps } from './TagsPage.interface';

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

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        onClose();
      }
    },
    [onClose]
  );

  return (
    <SlideoutMenu
      data-testid="tag-form-drawer"
      isOpen={open}
      onOpenChange={handleOpenChange}
    >
      {({ close }) => (
        <>
          <SlideoutMenu.Header data-testid="drawer-header" onClose={close}>
            <Typography as="h4" data-testid="drawer-heading">
              {tagsFormHeader}
            </Typography>
          </SlideoutMenu.Header>

          <SlideoutMenu.Content>
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
          </SlideoutMenu.Content>

          <SlideoutMenu.Footer>
            <div className="tw:flex tw:justify-end tw:gap-4">
              <Button
                color="tertiary"
                data-testid="cancel-button"
                onClick={close}
              >
                {t('label.cancel')}
              </Button>
              <Button
                color="primary"
                data-testid="save-button"
                isDisabled={isLoading}
                isLoading={isLoading}
                onClick={() => formRef.submit()}
              >
                {t('label.save')}
              </Button>
            </div>
          </SlideoutMenu.Footer>
        </>
      )}
    </SlideoutMenu>
  );
};

export default TagFormDrawer;
