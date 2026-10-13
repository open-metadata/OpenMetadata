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
  FieldProp,
  FieldTypes,
  FormFields,
  HelperTextType,
  HookForm,
  SimpleModal,
} from '@openmetadata/ui-core-components';
import React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  LineageConfig,
  LineageConfigModalProps,
} from './EntityLineage.interface';

type DepthField = 'upstreamDepth' | 'downstreamDepth' | 'nodesPerLayer';

// Number inputs hold strings; the config stores numbers.
type LineageConfigFormValues = Record<DepthField, string>;

const LineageConfigModal: React.FC<LineageConfigModalProps> = ({
  visible,
  config,
  onCancel,
  onSave,
}) => {
  const { t } = useTranslation();
  const form = useForm<LineageConfigFormValues>({
    defaultValues: {
      upstreamDepth: String(config.upstreamDepth ?? ''),
      downstreamDepth: String(config.downstreamDepth ?? ''),
      nodesPerLayer: String(config.nodesPerLayer ?? ''),
    },
  });

  const getNumberField = (
    name: DepthField,
    label: string,
    tooltip: string,
    min: number,
    testId: string
  ): FieldProp => ({
    name,
    label,
    type: FieldTypes.NUMBER,
    required: true,
    helperText: tooltip,
    helperTextType: HelperTextType.TOOLTIP,
    props: { inputDataTestId: testId },
    rules: {
      required: t('message.field-text-is-required', { fieldText: label }),
      validate: (value) =>
        Number(value) >= min ||
        t('message.entity-size-less-than', { entity: label, min }),
    },
  });

  const fields: FieldProp[] = [
    getNumberField(
      'upstreamDepth',
      t('label.upstream-depth'),
      t('message.upstream-depth-tooltip'),
      0,
      'field-upstream'
    ),
    getNumberField(
      'downstreamDepth',
      t('label.downstream-depth'),
      t('message.downstream-depth-tooltip'),
      0,
      'field-downstream'
    ),
    getNumberField(
      'nodesPerLayer',
      t('label.nodes-per-layer'),
      t('message.nodes-per-layer-tooltip'),
      5,
      'field-nodes-per-layer'
    ),
  ];

  const handleSave = (values: LineageConfigFormValues) =>
    onSave({
      upstreamDepth: Number(values.upstreamDepth),
      downstreamDepth: Number(values.downstreamDepth),
      nodesPerLayer: Number(values.nodesPerLayer),
    } as LineageConfig);

  return (
    <SimpleModal
      isDismissable={false}
      isOpen={visible}
      title={t('label.lineage-config')}
      onCancel={onCancel}
      onOk={form.handleSubmit(handleSave)}>
      <HookForm
        className="tw:flex tw:flex-col tw:gap-4"
        form={form}
        onSubmit={form.handleSubmit(handleSave)}>
        <FormFields fields={fields} />
      </HookForm>
    </SimpleModal>
  );
};

export default LineageConfigModal;
