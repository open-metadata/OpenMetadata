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
import { Button, Card, Space, Tabs, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CSMode } from '../../../enums/codemirror.enum';
import SchemaEditor from '../../Database/SchemaEditor/SchemaEditor';
import { ContractDetailFormTab } from '../ContractDetailFormTab/ContractDetailFormTab';
import { ContractQualityFormTab } from '../ContractQualityFormTab/ContractQualityFormTab';
import { ContractSchemaFormTab } from '../ContractSchemaFormTab/ContractScehmaFormTab';
import { ContractSecurityFormTab } from '../ContractSecurityFormTab/ContractSecurityFormTab';
import { ContractSemanticFormTab } from '../ContractSemanticFormTab/ContractSemanticFormTab';
import { ContractSLAFormTab } from '../ContractSLAFormTab/ContractSLAFormTab';

export const AddDataContract = () => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'YAML' | 'UI'>('UI');
  const [yaml, setYaml] = useState('');

  const items = useMemo(
    () => [
      {
        label: t('label.contract-detail-plural'),
        key: 'contract-detail',
        children: <ContractDetailFormTab />,
      },
      {
        label: t('label.schema'),
        key: 'schema',
        children: <ContractSchemaFormTab />,
      },
      {
        label: t('label.semantics'),
        key: 'semantics',
        children: <ContractSemanticFormTab />,
      },
      {
        label: t('label.security'),
        key: 'security',
        children: <ContractSecurityFormTab />,
      },
      {
        label: t('label.quality'),
        key: 'quality',
        children: <ContractQualityFormTab />,
      },
      {
        label: t('label.sla'),
        key: 'sla',
        children: <ContractSLAFormTab />,
      },
    ],
    [t]
  );

  const cardTitle = useMemo(() => {
    return (
      <Space className="w-full">
        <div className="d-flex item-center justify-between">
          <Typography.Title level={5}>{t('label.schema')}</Typography.Title>
          <Typography.Text type="secondary">
            {t('label.yaml-mode-description')}
          </Typography.Text>
          <div>
            <Button.Group>
              <Button
                type={mode === 'YAML' ? 'primary' : 'default'}
                onClick={() => setMode('YAML')}>
                {t('label.yaml-mode')}
              </Button>
              <Button
                type={mode === 'UI' ? 'primary' : 'default'}
                onClick={() => setMode('UI')}>
                {t('label.ui-mode')}
              </Button>
            </Button.Group>
          </div>
        </div>
        <div>
          <Button type="default">{t('label.cancel')}</Button>
          <Button type="primary">{t('label.save')}</Button>
        </div>
      </Space>
    );
  }, [mode, t]);

  const cardContent = useMemo(() => {
    if (mode === 'YAML') {
      return (
        <SchemaEditor
          mode={{ name: CSMode.YAML }}
          value={yaml}
          onChange={setYaml}
        />
      );
    }

    return <Tabs items={items} tabPosition="left" />;
  }, [mode, items, t]);

  return <Card title={cardTitle}>{cardContent}</Card>;
};
