/* eslint-disable no-console */
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
/* eslint-disable i18next/no-literal-string */
import { FieldErrorProps } from '@rjsf/utils';
import { Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SemanticsRule } from '../../../generated/entity/data/dataContract';
import QueryBuilderWidget from '../../common/Form/JSONSchema/JsonSchemaWidgets/QueryBuilderWidget/QueryBuilderWidget';

export const ContractSemanticFormTab: React.FC = () => {
  const { t } = useTranslation();
  const [semantics, setSemantics] = useState<SemanticsRule[]>([]);
  const handleChange = (value: SemanticsRule[]) => {
    console.log(value);
    setSemantics(value);
  };

  return (
    <div className="container">
      <Typography.Title level={5}>
        {t('label.semantic-plural')}
      </Typography.Title>
      <Typography.Text type="secondary">
        {t('label.semantics-description')}
      </Typography.Text>
      <QueryBuilderWidget
        id="semantics"
        label={t('label.semantics')}
        name="semantics"
        options={{
          addButtonText: t('label.add-semantic'),
          removeButtonText: t('label.remove-semantic'),
        }}
        registry={{} as FieldErrorProps['registry']}
        schema={{
          type: 'array',
          items: {
            type: 'object',
            properties: {},
          },
        }}
        value={semantics}
        onBlur={() => {
          // TODO: Implement onBlur
        }}
        onChange={handleChange}
        onFocus={() => {
          // TODO: Implement onFocus
        }}
      />
    </div>
  );
};
