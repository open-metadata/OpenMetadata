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
  Button,
  Dialog,
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomProperty } from '../../../../generated/type/customProperty';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { getPropertyTypeMeta } from './CustomPropertyCard.utils';
import { getPropertyRenderer } from './CustomPropertyRenderers';

const MODAL_WIDTH = 560;
const WIDE_MODAL_WIDTH = 960;

interface CustomPropertyEditModalProps {
  property: CustomProperty;
  value: unknown;
  isNewValue: boolean;
  isSaving: boolean;
  onSave: (value: unknown) => void;
  onCancel: () => void;
}

export const CustomPropertyEditModal = ({
  property,
  value,
  isNewValue,
  isSaving,
  onSave,
  onCancel,
}: CustomPropertyEditModalProps) => {
  const { t } = useTranslation();
  const formId = useId();
  const typeName = property.propertyType.name;
  const { Edit } = getPropertyRenderer(typeName);
  const { isWide } = getPropertyTypeMeta(typeName);
  const title = t(isNewValue ? 'label.set-entity' : 'label.edit-entity', {
    entity: getEntityName(property),
  });

  return (
    <ModalOverlay
      isOpen
      isDismissable={!isSaving}
      onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <Modal>
        <Dialog
          aria-label={title}
          data-testid="custom-property-edit-modal"
          width={isWide ? WIDE_MODAL_WIDTH : MODAL_WIDTH}
          onClose={onCancel}>
          <Dialog.Header>
            <Typography
              as="h3"
              className="tw:text-primary"
              size="text-lg"
              weight="semibold">
              {title}
            </Typography>
          </Dialog.Header>
          <Dialog.Content>
            <Edit
              formId={formId}
              isSaving={isSaving}
              property={property}
              value={value}
              onSave={onSave}
            />
          </Dialog.Content>
          <Dialog.Footer>
            <Button
              color="secondary"
              data-testid="inline-cancel-btn"
              isDisabled={isSaving}
              size="md"
              onPress={onCancel}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary"
              data-testid="inline-save-btn"
              form={formId}
              isLoading={isSaving}
              size="md"
              type="submit">
              {t('label.save')}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
