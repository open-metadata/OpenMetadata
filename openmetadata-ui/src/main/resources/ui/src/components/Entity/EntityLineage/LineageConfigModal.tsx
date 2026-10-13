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
  Box,
  FormField,
  HookForm,
  NumberInput,
  SimpleModal,
} from '@openmetadata/ui-core-components';
import React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  LineageConfig,
  LineageConfigModalProps,
} from './EntityLineage.interface';

const LineageConfigModal: React.FC<LineageConfigModalProps> = ({
  visible,
  config,
  onCancel,
  onSave,
}) => {
  const { t } = useTranslation();
  const form = useForm<LineageConfig>({
    defaultValues: {
      upstreamDepth: config.upstreamDepth,
      downstreamDepth: config.downstreamDepth,
      nodesPerLayer: config.nodesPerLayer,
    },
    mode: 'onChange',
  });
  const handleSubmit = form.handleSubmit((values) => onSave(values));
  const fields = [
    {
      name: 'upstreamDepth',
      label: t('label.upstream-depth'),
      minimum: 0,
      tooltip: t('message.upstream-depth-tooltip'),
      testId: 'field-upstream',
    },
    {
      name: 'downstreamDepth',
      label: t('label.downstream-depth'),
      minimum: 0,
      tooltip: t('message.downstream-depth-tooltip'),
      testId: 'field-downstream',
    },
    {
      name: 'nodesPerLayer',
      label: t('label.nodes-per-layer'),
      minimum: 5,
      tooltip: t('message.nodes-per-layer-tooltip'),
      testId: 'field-nodes-per-layer',
    },
  ] as const;

  return (
    <SimpleModal
      isDismissable={false}
      isOpen={visible}
      title={t('label.lineage-config')}
      onCancel={onCancel}
      onOk={handleSubmit}>
      <HookForm form={form} onSubmit={handleSubmit}>
        <Box direction="col" gap={4}>
          {fields.map(({ name, label, minimum, tooltip, testId }) => (
            <FormField
              control={form.control}
              key={name}
              name={name}
              rules={{
                required: t('message.field-text-is-required', {
                  fieldText: label,
                }),
                min: {
                  value: minimum,
                  message: t('message.entity-size-less-than', {
                    entity: label,
                    min: minimum,
                  }),
                },
              }}>
              {({ field, fieldState }) => (
                <NumberInput
                  {...field}
                  aria-label={label}
                  hint={fieldState.error?.message}
                  inputDataTestId={testId}
                  isInvalid={!!fieldState.error}
                  label={label}
                  tooltip={tooltip}
                />
              )}
            </FormField>
          ))}
        </Box>
      </HookForm>
    </SimpleModal>
  );
};

export default LineageConfigModal;
