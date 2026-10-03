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
  Input,
  Modal,
  ModalOverlay,
} from '@openmetadata/ui-core-components';
import React, { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  LineageConfig,
  LineageConfigModalProps,
} from './EntityLineage.interface';

type DepthField = 'upstreamDepth' | 'downstreamDepth' | 'nodesPerLayer';

type LineageConfigFormValues = Record<DepthField, string>;

const FIELDS: {
  name: DepthField;
  label: string;
  tooltip: string;
  testId: string;
  min: number;
}[] = [
  {
    name: 'upstreamDepth',
    label: 'label.upstream-depth',
    tooltip: 'message.upstream-depth-tooltip',
    testId: 'field-upstream',
    min: 0,
  },
  {
    name: 'downstreamDepth',
    label: 'label.downstream-depth',
    tooltip: 'message.downstream-depth-tooltip',
    testId: 'field-downstream',
    min: 0,
  },
  {
    name: 'nodesPerLayer',
    label: 'label.nodes-per-layer',
    tooltip: 'message.nodes-per-layer-tooltip',
    testId: 'field-nodes-per-layer',
    min: 5,
  },
];

const toFormValues = (config: LineageConfig): LineageConfigFormValues => ({
  upstreamDepth: String(config.upstreamDepth ?? ''),
  downstreamDepth: String(config.downstreamDepth ?? ''),
  nodesPerLayer: String(config.nodesPerLayer ?? ''),
});

const LineageConfigModal: React.FC<LineageConfigModalProps> = ({
  visible,
  config,
  onCancel,
  onSave,
}) => {
  const { t } = useTranslation();
  const { control, handleSubmit, reset } = useForm<LineageConfigFormValues>({
    defaultValues: toFormValues(config),
  });

  useEffect(() => {
    if (visible) {
      reset(toFormValues(config));
    }
  }, [visible, config, reset]);

  // Only the edited fields are emitted, matching the previous AntD onFinish payload.
  const onSubmit = handleSubmit((values) =>
    onSave({
      upstreamDepth: Number(values.upstreamDepth),
      downstreamDepth: Number(values.downstreamDepth),
      nodesPerLayer: Number(values.nodesPerLayer),
    } as LineageConfig)
  );

  return (
    <ModalOverlay
      isDismissable={false}
      isOpen={visible}
      style={{ zIndex: 'var(--om-z-modal)' }}
      onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <Modal>
        <Dialog
          showCloseButton
          title={t('label.lineage-config')}
          width={520}
          onClose={onCancel}>
          <Dialog.Content>
            <form className="tw:flex tw:flex-col tw:gap-4" onSubmit={onSubmit}>
              {FIELDS.map(({ name, label, tooltip, testId, min }) => (
                <Controller
                  control={control}
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
              ))}
            </form>
          </Dialog.Content>
          <Dialog.Footer>
            <Button color="secondary" onPress={onCancel}>
              {t('label.cancel')}
            </Button>
            <Button color="primary" onPress={() => onSubmit()}>
              {t('label.ok')}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default LineageConfigModal;
