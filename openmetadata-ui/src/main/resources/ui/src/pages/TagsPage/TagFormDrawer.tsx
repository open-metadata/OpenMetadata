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
  SlideoutMenu,
  Typography,
} from '@openmetadata/ui-core-components';
import { isUndefined } from 'lodash';
import { FC, useCallback, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ProviderType } from '../../generated/api/classification/createTag';
import TagsForm from './TagsForm';
import { TagFormDrawerProps } from './TagsPage.interface';

const TagFormDrawer: FC<TagFormDrawerProps> = ({
  open,
  editTag,
  parentFqn,
  sessionId,
  form,
  isTier,
  isLoading,
  permissions,
  isParentAutoClassificationEnabled,
  tagsFormHeader,
  onClose,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const headingId = useId();
  const submitRef = useRef<() => void>(() => void 0);

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
      aria-labelledby={headingId}
      className="tw:z-999"
      data-testid="tag-form-drawer"
      isOpen={open}
      width="40%"
      onOpenChange={handleOpenChange}>
      {({ close }) => (
        <>
          <SlideoutMenu.Header data-testid="drawer-header" onClose={close}>
            <Typography as="h4" data-testid="drawer-heading" id={headingId}>
              {tagsFormHeader}
            </Typography>
          </SlideoutMenu.Header>

          <SlideoutMenu.Content>
            {parentFqn && (
              <Box direction="col" gap={1}>
                <Typography as="span" size="text-sm" weight="medium">
                  {t('label.parent-tag')}
                </Typography>
                <Typography
                  className="tw:break-all"
                  color="secondary"
                  data-testid="parent-tag"
                  size="text-sm"
                  translate="no">
                  {parentFqn}
                </Typography>
              </Box>
            )}
            <TagsForm
              form={form}
              initialValues={editTag}
              isEditing={!isUndefined(editTag)}
              isParentAutoClassificationEnabled={
                isParentAutoClassificationEnabled
              }
              isSystemTag={editTag?.provider === ProviderType.System}
              isTier={isTier}
              key={sessionId ?? editTag?.id ?? 'new-tag'}
              permissions={permissions}
              submitRef={submitRef}
              onSubmit={onSubmit}
            />
          </SlideoutMenu.Content>

          <SlideoutMenu.Footer>
            <Box gap={4} justify="end">
              <Button
                color="tertiary"
                data-testid="cancel-button"
                onClick={close}>
                {t('label.cancel')}
              </Button>
              <Button
                color="primary"
                data-testid="save-button"
                isDisabled={isLoading}
                isLoading={isLoading}
                onClick={() => submitRef.current()}>
                {t('label.save')}
              </Button>
            </Box>
          </SlideoutMenu.Footer>
        </>
      )}
    </SlideoutMenu>
  );
};

export default TagFormDrawer;
