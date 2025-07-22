/* eslint-disable @typescript-eslint/no-explicit-any */
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

import { CodeOutlined, EditOutlined, TableOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Divider,
  Form,
  Radio,
  RadioChangeEvent,
  Tabs,
  Typography,
} from 'antd';
import { FormProviderProps } from 'antd/lib/form/context';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CSMode } from '../../../enums/codemirror.enum';
import SchemaEditor from '../../Database/SchemaEditor/SchemaEditor';
import { ContractDetailFormTab } from '../ContractDetailFormTab/ContractDetailFormTab';
import { ContractQualityFormTab } from '../ContractQualityFormTab/ContractQualityFormTab';
import { ContractSchemaFormTab } from '../ContractSchemaFormTab/ContractScehmaFormTab';
import { ContractSecurityFormTab } from '../ContractSecurityFormTab/ContractSecurityFormTab';
import { ContractSemanticFormTab } from '../ContractSemanticFormTab/ContractSemanticFormTab';
import { ContractSLAFormTab } from '../ContractSLAFormTab/ContractSLAFormTab';
import './add-data-contract.less';

export interface FormStepProps {
  onNext: () => void;
  onPrev: () => void;
  nextLabel?: string;
  prevLabel?: string;
  isNextVisible?: boolean;
  isPrevVisible?: boolean;
}

const TABS = ['contract-detail', 'schema', 'semantics', 'security', 'quality'];

const AddDataContract: React.FC = () => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'YAML' | 'UI'>('YAML');
  const [yaml, setYaml] = useState('');
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState(TABS[0]);

  const handleFormChange: FormProviderProps['onFormFinish'] = (
    name: string,
    { forms, values }: { forms: Record<string, any>; values: any }
  ) => {
    console.log(name, forms, values);
    setFormValues(values);
  };

  const handleTabChange = useCallback((key: string) => {
    setActiveTab(key);
  }, []);

  const isNextVisible = useMemo(() => {
    return activeTab !== TABS[TABS.length - 1];
  }, [activeTab]);

  const isPrevVisible = useMemo(() => {
    return activeTab !== TABS[0];
  }, [activeTab]);

  const onNext = useCallback(() => {
    setActiveTab(TABS[TABS.indexOf(activeTab) + 1]);
  }, [activeTab]);

  const onPrev = useCallback(() => {
    setActiveTab(TABS[TABS.indexOf(activeTab) - 1]);
  }, [activeTab]);

  const nextLabel = useMemo(() => {
    return TABS[TABS.indexOf(activeTab) + 1];
  }, [activeTab]);

  const prevLabel = useMemo(() => {
    return TABS[TABS.indexOf(activeTab) - 1];
  }, [activeTab]);

  const items = useMemo(
    () => [
      {
        label: (
          <div className="d-flex items-center">
            <TableOutlined />
            <span>{t('label.contract-detail-plural')}</span>
          </div>
        ),
        key: 'contract-detail',
        children: <ContractDetailFormTab />,
      },
      {
        label: (
          <div className="d-flex items-center">
            <TableOutlined />
            <span>{t('label.schema')}</span>
          </div>
        ),
        key: 'schema',
        children: <ContractSchemaFormTab />,
      },
      {
        label: (
          <div className="d-flex items-center">
            <TableOutlined />
            <span>{t('label.semantic-plural')}</span>
          </div>
        ),
        key: 'semantics',
        children: <ContractSemanticFormTab />,
      },
      {
        label: (
          <div className="d-flex items-center">
            <TableOutlined />
            <span>{t('label.security')}</span>
          </div>
        ),
        key: 'security',
        children: <ContractSecurityFormTab />,
      },
      {
        label: (
          <div className="d-flex items-center">
            <TableOutlined />
            <span>{t('label.quality')}</span>
          </div>
        ),
        key: 'quality',
        children: <ContractQualityFormTab />,
      },
      {
        label: (
          <div className="d-flex items-center">
            <TableOutlined />
            <span>{t('label.sla')}</span>
          </div>
        ),
        key: 'sla',
        children: <ContractSLAFormTab />,
      },
    ],
    [t]
  );

  const handleModeChange = useCallback((e: RadioChangeEvent) => {
    setMode(e.target.value);
  }, []);

  const cardTitle = useMemo(() => {
    return (
      <div className="d-flex items-center justify-between">
        <div className="d-flex item-center justify-between flex-1">
          <div>
            <Typography.Title className="m-0" level={5}>
              {t('label.add-contract-detail-plural')}
            </Typography.Title>
            <Typography.Paragraph className="m-0 text-sm" type="secondary">
              {t('message.add-contract-detail-description')}
            </Typography.Paragraph>
          </div>
          <div className="d-flex items-center">
            <Radio.Group
              optionType="button"
              options={[
                { label: <CodeOutlined />, value: 'YAML' },
                { label: <EditOutlined />, value: 'UI' },
              ]}
              value={mode}
              onChange={handleModeChange}
            />
            <Divider type="vertical" />
          </div>
        </div>
        <div>
          <Button type="default">{t('label.cancel')}</Button>
          <Button className="m-l-sm" type="primary">
            {t('label.save')}
          </Button>
        </div>
      </div>
    );
  }, [mode, t, handleModeChange]);

  const cardContent = useMemo(() => {
    if (mode === 'YAML') {
      return (
        <Card>
          <SchemaEditor
            mode={{ name: CSMode.YAML }}
            value={yaml}
            onChange={setYaml}
          />
        </Card>
      );
    }

    return (
      <Form.Provider onFormFinish={handleFormChange}>
        <Tabs
          activeKey={activeTab}
          className="contract-tabs"
          items={items}
          tabPosition="left"
          onChange={handleTabChange}
        />
      </Form.Provider>
    );
  }, [mode, items, t, handleFormChange]);

  return (
    <Card className="h-full" title={cardTitle}>
      {cardContent}

      <SchemaEditor
        mode={{ name: CSMode.JAVASCRIPT }}
        value={JSON.stringify(formValues, null, 2)}
      />

      <div className="d-flex justify-end">
        {isPrevVisible ? (
          <Button type="default" onClick={onPrev}>
            {prevLabel ?? t('label.prev')}
          </Button>
        ) : null}
        {isNextVisible ? (
          <Button type="primary" onClick={onNext}>
            {nextLabel ?? t('label.next')}
          </Button>
        ) : null}
      </div>
    </Card>
  );
};

export default AddDataContract;
