/*
 *  Copyright 2024 Collate.
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
  Dialog,
  Modal,
  ModalOverlay,
} from '@openmetadata/ui-core-components';
import { FC, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomPropertyChanges } from '../../../../rest/metadataTypeAPI';
import CustomPropertyEditForm from '../CustomPropertyEditForm/CustomPropertyEditForm';
import { isEnumProperty } from '../CustomPropertyEditForm/CustomPropertyEditForm.utils';
import { EditCustomPropertyModalProps } from './EditCustomPropertyModal.interface';

const MODAL_WIDTH = 720;

const EditCustomPropertyModal: FC<EditCustomPropertyModalProps> = ({
  customProperty,
  onCancel,
  onSave,
}) => {
  const { t } = useTranslation();
  const formId = useId();
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (changes: CustomPropertyChanges) => {
    setIsSaving(true);
    try {
      await onSave(changes);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalOverlay
      isOpen
      isDismissable={!isSaving}
      onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <Modal>
        <Dialog
          data-testid="edit-custom-property-modal"
          width={MODAL_WIDTH}
          onClose={onCancel}>
          <Dialog.Header
            title={t('label.edit-entity-name', {
              entityType: t('label.property'),
              entityName: customProperty.name,
            })}
          />
          <Dialog.Content>
            <CustomPropertyEditForm
              formId={formId}
              property={customProperty}
              onSubmit={handleSubmit}
            />
            {isSaving && isEnumProperty(customProperty) && (
              <Alert
                className="tw:mt-4"
                title={t('message.enum-property-update-message')}
                variant="success"
              />
            )}
          </Dialog.Content>
          <Dialog.Footer>
            <Button
              color="secondary"
              data-testid="edit-custom-property-cancel"
              isDisabled={isSaving}
              size="md"
              onPress={onCancel}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary"
              data-testid="edit-custom-property-save"
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

export default EditCustomPropertyModal;
