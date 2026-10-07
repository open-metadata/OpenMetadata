/*
 *  Copyright 2023 Collate.
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
  HookForm,
  Input,
  Modal,
  ModalOverlay,
} from '@openmetadata/ui-core-components';
import React, { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { LINEAGE_CONFIG_FIELDS } from '../../../constants/Lineage.constants';
import { getLineageConfigFormValues } from '../../../utils/EntityLineagePureUtils';
import {
  LineageConfig,
  LineageConfigFormValues,
  LineageConfigModalProps,
} from './EntityLineage.interface';

const LineageConfigModal: React.FC<LineageConfigModalProps> = ({
  visible,
  config,
  onCancel,
  onSave,
}) => {
  const { t } = useTranslation();
  const form = useForm<LineageConfigFormValues>({
    defaultValues: getLineageConfigFormValues(config),
  });

  useEffect(() => {
    if (visible) {
      form.reset(getLineageConfigFormValues(config));
    }
  }, [visible, config, form.reset, form]);

  // Only the edited fields are emitted, matching the previous AntD onFinish payload.
  const onSubmit = (values: LineageConfigFormValues) =>
    onSave({
      upstreamDepth: Number(values.upstreamDepth),
      downstreamDepth: Number(values.downstreamDepth),
      nodesPerLayer: Number(values.nodesPerLayer),
    } as LineageConfig);

  return (
    <ModalOverlay
      isDismissable={false}
      isOpen={visible}
      onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <Modal>
        <Dialog
          showCloseButton
          title={t('label.lineage-config')}
          width={520}
          onClose={onCancel}>
          <Dialog.Content>
            <HookForm<LineageConfigFormValues>
              form={form}
              onSubmit={form.handleSubmit(onSubmit)}>
              {LINEAGE_CONFIG_FIELDS.map(
                ({ name, label, tooltip, testId, min }) => (
                  <Controller
                    control={form.control}
                    key={name}
                    name={name}
                    render={({ field, fieldState }) => (
                      <Input
                        isRequired
                        hint={fieldState.error?.message}
                        inputDataTestId={testId}
                        isInvalid={Boolean(fieldState.error)}
                        label={t(label)}
                        name={field.name}
                        ref={field.ref}
                        tooltip={t(tooltip)}
                        type="number"
                        validationBehavior="aria"
                        value={field.value}
                        onBlur={field.onBlur}
                        onChange={field.onChange}
                      />
                    )}
                    rules={{
                      required: t('message.field-text-is-required', {
                        fieldText: t(label),
                      }),
                      min: {
                        value: min,
                        message: t('message.entity-size-less-than', {
                          entity: t(label),
                          min,
                        }),
                      },
                    }}
                  />
                )
              )}
            </HookForm>
          </Dialog.Content>
          <Dialog.Footer>
            <Button color="secondary" onPress={onCancel}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary"
              onPress={() => form.handleSubmit(onSubmit)()}>
              {t('label.ok')}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default LineageConfigModal;
