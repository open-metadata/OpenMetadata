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
  Button,
  SlideoutMenu,
  Typography,
} from '@openmetadata/ui-core-components';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ENTITY_TYPE_LABEL_KEYS } from '../../utils/IntakeFormUtils';
import IntakeFormDesignerBody, {
  IntakeFormDesignerBodyHandle,
} from './IntakeFormDesignerBody';
import { IntakeFormDesignerModalProps } from './IntakeFormDesignerModal.interface';

const IntakeFormDesignerModal = ({
  open,
  entityType,
  initialValue,
  onCancel,
  onSubmit,
}: IntakeFormDesignerModalProps) => {
  const { t } = useTranslation();
  const bodyRef = useRef<IntakeFormDesignerBodyHandle>(null);

  const title = initialValue?.id
    ? t('label.edit-entity', {
        entity: t('label.entity-intake-form', {
          entity: t(ENTITY_TYPE_LABEL_KEYS[entityType]),
        }),
      })
    : t('label.add-entity', {
        entity: t('label.entity-intake-form', {
          entity: t(ENTITY_TYPE_LABEL_KEYS[entityType]),
        }),
      });

  return (
    <SlideoutMenu
      isDismissable
      dialogClassName="tw:overflow-hidden!"
      isOpen={open}
      width="75%"
      onOpenChange={(isOpenState) => {
        if (!isOpenState) {
          onCancel();
        }
      }}>
      {() => (
        <>
          <SlideoutMenu.Header onClose={onCancel}>
            <Typography size="text-lg" weight="semibold">
              {title}
            </Typography>
          </SlideoutMenu.Header>

          <SlideoutMenu.Content
            className="tw:relative tw:min-h-0 tw:flex-1 tw:overflow-hidden! tw:p-0!"
            data-testid="intake-form-designer-modal">
            <div className="tw:absolute tw:inset-0 tw:overflow-y-auto tw:pt-0">
              <IntakeFormDesignerBody
                entityType={entityType}
                initialValue={initialValue}
                open={open}
                ref={bodyRef}
                onSubmit={onSubmit}
              />
            </div>
          </SlideoutMenu.Content>

          <SlideoutMenu.Footer>
            <Box gap={3} justify="end">
              <Button
                color="tertiary"
                data-testid="intake-form-cancel"
                size="sm"
                onClick={onCancel}>
                {t('label.cancel')}
              </Button>
              <Button
                color="primary"
                data-testid="intake-form-submit"
                size="sm"
                onClick={() => bodyRef.current?.submit()}>
                {initialValue?.id ? t('label.save') : t('label.create')}
              </Button>
            </Box>
          </SlideoutMenu.Footer>
        </>
      )}
    </SlideoutMenu>
  );
};

export default IntakeFormDesignerModal;
