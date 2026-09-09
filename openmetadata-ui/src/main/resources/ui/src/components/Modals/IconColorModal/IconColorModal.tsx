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
  Dialog,
  FieldProp,
  FieldTypes,
  getField,
  HelperTextType,
  HookForm,
  Modal,
  ModalOverlay,
} from '@openmetadata/ui-core-components';
import { FC, useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Style } from '../../../generated/type/schema';
import { AVAILABLE_ICONS, DEFAULT_TAG_ICON } from '../../common/IconPicker';
import { StyleModalProps } from '../StyleModal/StyleModal.interface';

const ICON_OPTIONS = [
  DEFAULT_TAG_ICON,
  ...AVAILABLE_ICONS.filter((icon) => icon.name !== DEFAULT_TAG_ICON.name),
].map((icon) => ({
  icon: icon.component,
  id: icon.name,
  label: icon.name,
}));

const IconColorModal: FC<StyleModalProps> = ({
  open,
  onCancel,
  onSubmit,
  style,
}) => {
  const { t } = useTranslation();
  const form = useForm<Style>({
    defaultValues: {
      iconURL: style?.iconURL,
      color: style?.color,
    },
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // The parent keeps this modal mounted and only toggles `open`, so
  // useForm's defaultValues (captured once at mount) go stale across
  // reopens with a different `style` — reset on every open to pick up
  // the latest values.
  useEffect(() => {
    if (open) {
      form.reset({ iconURL: style?.iconURL, color: style?.color });
    }
  }, [open]);

  const selectedColor = useWatch({ control: form.control, name: 'color' });

  const handleSubmit = async (values: Style) => {
    try {
      setIsSaving(true);
      await onSubmit(values);
    } finally {
      setIsSaving(false);
    }
  };

  const iconField: FieldProp = {
    helperText: t('message.icon-aspect-ratio'),
    helperTextType: HelperTextType.TOOLTIP,
    id: 'root/iconURL',
    label: t('label.icon'),
    name: 'iconURL',
    placeholder: t('label.icon-url'),
    props: {
      allowUrl: true,
      backgroundColor: selectedColor,
      'data-testid': 'icon-picker-btn',
      defaultIcon: DEFAULT_TAG_ICON,
      options: ICON_OPTIONS,
    },
    type: FieldTypes.ICON_PICKER,
  };

  const colorField: FieldProp = {
    id: 'root/color',
    label: t('label.color'),
    name: 'color',
    type: FieldTypes.COLOR_PICKER,
  };

  return (
    <ModalOverlay
      isDismissable={!isSaving}
      isOpen={open}
      onOpenChange={(v) => !v && !isSaving && onCancel()}>
      <Modal data-testid="icon-color-modal">
        <Dialog title={t('label.edit-entity', { entity: t('label.style') })}>
          <Dialog.Content>
            <HookForm
              form={form}
              id="style-modal-new"
              onSubmit={form.handleSubmit(handleSubmit)}>
              <div className="tw:mb-6">{getField(iconField)}</div>
              <div className="tw:mb-6">{getField(colorField)}</div>
            </HookForm>
          </Dialog.Content>

          <Dialog.Footer>
            <Button
              color="secondary"
              data-testid="cancel-button"
              isDisabled={isSaving}
              onPress={onCancel}>
              {t('label.cancel')}
            </Button>
            <Button
              showTextWhileLoading
              color="primary"
              data-testid="save-button"
              isDisabled={isSaving}
              isLoading={isSaving}
              onPress={() => form.handleSubmit(handleSubmit)()}>
              {t('label.save')}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default IconColorModal;
