/*
 *  Copyright 2022 Collate.
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

import { FieldProp, FieldTypes } from 'interface/FormUtils.interface';
import React, { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { generateFormFields } from 'utils/formUtils';

interface Props {
  dbtClassificationName: string | undefined;
  descriptionId: string;
  dbtUpdateDescriptions: boolean;
  enableDebugLog: boolean;
  includeTags: boolean;
  parsingTimeoutLimit: number;
}

function DBTCommonFields({
  descriptionId,
  dbtUpdateDescriptions,
  dbtClassificationName,
  enableDebugLog,
  includeTags,
  parsingTimeoutLimit,
}: Props) {
  const { t } = useTranslation();

  const commonFields: FieldProp[] = [
    {
      name: 'dbtClassificationName',
      label: t('label.dbt-classification-name'),
      type: FieldTypes.TEXT,
      required: false,
      props: {
        'data-testid': 'dbt-classification-name',
      },
      id: 'root/dbtClassificationName',
      helperText: t('message.custom-classification-name-dbt-tags'),
      hasSeparator: true,
      formItemProps: {
        initialValue: dbtClassificationName,
      },
    },
    {
      name: 'loggerLevel',
      label: t('label.enable-debug-log'),
      type: FieldTypes.SWITCH,
      required: false,
      props: {
        'data-testid': 'toggle-button-enable-debug-log',
      },
      id: 'root/loggerLevel',
      hasSeparator: true,
      helperText: t('message.enable-debug-logging'),
      formItemLayout: 'horizontal',
      formItemProps: {
        initialValue: enableDebugLog,
        valuePropName: 'checked',
      },
    },
    {
      name: 'dbtUpdateDescriptions',
      label: t('label.update-description'),
      type: FieldTypes.SWITCH,
      required: false,
      props: {
        'data-testid': descriptionId,
      },
      id: 'root/dbtUpdateDescriptions',
      hasSeparator: true,
      helperText: t('message.optional-configuration-update-description-dbt'),
      formItemLayout: 'horizontal',
      formItemProps: {
        initialValue: dbtUpdateDescriptions,
        valuePropName: 'checked',
      },
    },
    {
      name: 'includeTags',
      label: t('label.include-entity', { entity: t('label.tag-plural') }),
      type: FieldTypes.SWITCH,
      required: false,
      props: {
        'data-testid': 'toggle-button-include-tags',
      },
      id: 'root/includeTags',
      hasSeparator: true,
      helperText: t('message.include-assets-message'),
      formItemLayout: 'horizontal',
      formItemProps: {
        initialValue: includeTags,
        valuePropName: 'checked',
      },
    },
    {
      name: 'parsingTimeoutLimit',
      label: t('label.parsing-timeout-limit'),
      type: FieldTypes.NUMBER,
      required: false,
      props: {
        'data-testid': 'dbt-parsing-timeout-limit',
      },
      id: 'root/parsingTimeoutLimit',
      hasSeparator: true,
      formItemProps: {
        initialValue: parsingTimeoutLimit,
      },
    },
  ];

  return <Fragment>{generateFormFields(commonFields)}</Fragment>;
}

export default DBTCommonFields;
