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
} from '@openmetadata/ui-core-components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CustomPropertiesWidgetSettings,
  CustomPropertiesWidgetStyle,
} from './CustomPropertiesWidget.types';
import {
  getWidgetStyle,
  isCustomPropertiesWidgetSettingsValid,
} from './CustomPropertiesWidget.utils';
import { CustomPropertiesWidgetSettingsForm } from './CustomPropertiesWidgetSettingsForm';

const MODAL_WIDTH = 760;

interface CustomPropertiesWidgetSettingsModalProps {
  entityType?: string;
  settings: CustomPropertiesWidgetSettings;
  onCancel: () => void;
  onSave: (
    settings: CustomPropertiesWidgetSettings,
    style: CustomPropertiesWidgetStyle
  ) => void;
}

export const CustomPropertiesWidgetSettingsModal = ({
  entityType,
  settings,
  onCancel,
  onSave,
}: CustomPropertiesWidgetSettingsModalProps) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(settings);
  const [style, setStyle] = useState(() => getWidgetStyle(settings));
  const title = t('label.configure-entity', {
    entity: t('label.custom-property-plural'),
  });

  return (
    <ModalOverlay
      isDismissable
      isOpen
      onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <Modal>
        <Dialog
          data-testid="custom-properties-widget-settings-modal"
          width={MODAL_WIDTH}
          onClose={onCancel}>
          <Dialog.Header title={title} />
          <Dialog.Content>
            <CustomPropertiesWidgetSettingsForm
              entityType={entityType}
              style={style}
              value={draft}
              onChange={setDraft}
              onStyleChange={setStyle}
            />
          </Dialog.Content>
          <Dialog.Footer>
            <Button color="secondary" size="md" onPress={onCancel}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary"
              data-testid="save-widget-settings"
              isDisabled={!isCustomPropertiesWidgetSettingsValid(draft)}
              size="md"
              onPress={() => onSave(draft, style)}>
              {t('label.save')}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
