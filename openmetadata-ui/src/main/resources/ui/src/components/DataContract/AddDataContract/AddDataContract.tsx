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
  message,
  Radio,
  RadioChangeEvent,
  Tabs,
  Typography,
} from 'antd';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CSMode } from '../../../enums/codemirror.enum';
import { CreateDataContract } from '../../../generated/api/data/createDataContract';
import { DataContract } from '../../../generated/entity/data/dataContract';
import SchemaEditor from '../../Database/SchemaEditor/SchemaEditor';
import { ContractDetailFormTab } from '../ContractDetailFormTab/ContractDetailFormTab';
import { ContractQualityFormTab } from '../ContractQualityFormTab/ContractQualityFormTab';
import { ContractSchemaFormTab } from '../ContractSchemaFormTab/ContractScehmaFormTab';
import { ContractSemanticFormTab } from '../ContractSemanticFormTab/ContractSemanticFormTab';
import './add-data-contract.less';

export interface FormStepProps {
  onNext: () => void;
  onPrev: () => void;
  nextLabel?: string;
  prevLabel?: string;
  isNextVisible?: boolean;
  isPrevVisible?: boolean;
}

const TABS = ['contract-detail', 'schema', 'semantics', 'quality'];

const AddDataContract: React.FC<{
  onCancel: () => void;
  onSubmit?: (data: CreateDataContract) => void;
}> = ({ onCancel, onSubmit }) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'YAML' | 'UI'>('UI');
  const [yaml, setYaml] = useState('');
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formValues, setFormValues] = useState<DataContract>(
    {} as DataContract
  );

  const handleTabChange = useCallback((key: string) => {
    setActiveTab(key);
  }, []);

  const onNext = useCallback(
    async (data: Partial<DataContract>) => {
      // Validate current tab before proceeding

      if (data) {
        try {
          setFormValues((prev) => ({ ...prev, ...data }));
          setActiveTab(TABS[TABS.indexOf(activeTab) + 1]);
        } catch (error) {
          console.error('Validation failed:', error);
          message.error(t('message.please-fill-required-fields'));
        }
      } else {
        setActiveTab(TABS[TABS.indexOf(activeTab) + 1]);
      }
    },
    [activeTab, t]
  );

  const onPrev = useCallback(() => {
    setActiveTab(TABS[TABS.indexOf(activeTab) - 1]);
  }, [activeTab]);

  const handleSave = useCallback(async () => {
    setIsSubmitting(true);

    try {
      if (onSubmit) {
        onSubmit(formValues);
      }

      message.success(t('message.data-contract-saved-successfully'));
    } catch (error) {
      console.error('Validation or submission failed:', error);
      message.error(t('message.please-fill-all-required-fields'));
    } finally {
      setIsSubmitting(false);
    }
  }, [onSubmit, t]);

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
        children: <ContractDetailFormTab onNext={onNext} />,
      },
      {
        label: (
          <div className="d-flex items-center">
            <TableOutlined />
            <span>{t('label.schema')}</span>
          </div>
        ),
        key: 'schema',
        children: (
          <ContractSchemaFormTab
            selectedSchema={
              formValues.schema?.map((column) => column.name) || []
            }
            onNext={onNext}
            onPrev={onPrev}
          />
        ),
      },
      {
        label: (
          <div className="d-flex items-center">
            <TableOutlined />
            <span>{t('label.semantic-plural')}</span>
          </div>
        ),
        key: 'semantics',
        children: <ContractSemanticFormTab onNext={onNext} onPrev={onPrev} />,
      },
      //   {
      //     label: (
      //       <div className="d-flex items-center">
      //         <TableOutlined />
      //         <span>{t('label.security')}</span>
      //       </div>
      //     ),
      //     key: 'security',
      //     children: <ContractSecurityFormTab />,
      //   },
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
      //   {
      //     label: (
      //       <div className="d-flex items-center">
      //         <TableOutlined />
      //         <span>{t('label.sla')}</span>
      //       </div>
      //     ),
      //     key: 'sla',
      //     children: <ContractSLAFormTab />,
      //   },
    ],
    [t, onNext, onPrev]
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
          <Button type="default" onClick={onCancel}>
            {t('label.cancel')}
          </Button>
          <Button
            className="m-l-sm"
            loading={isSubmitting}
            type="primary"
            onClick={handleSave}>
            {t('label.save')}
          </Button>
        </div>
      </div>
    );
  }, [mode, t, handleModeChange, onCancel, handleSave, isSubmitting]);

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
      <Tabs
        activeKey={activeTab}
        className="contract-tabs"
        items={items}
        tabPosition="left"
        onChange={handleTabChange}
      />
    );
  }, [mode, items, handleTabChange, activeTab, yaml]);

  return (
    <Card className="h-full" title={cardTitle}>
      {cardContent}

      {/* Debug: Show accumulated form data */}
      <div className="m-t-md">
        <Typography.Title level={5}>
          {t('label.debug-accumulated-form-data')}
        </Typography.Title>
        <SchemaEditor
          readOnly
          mode={{ name: CSMode.JAVASCRIPT }}
          value={JSON.stringify(formValues, null, 2)}
        />
      </div>
    </Card>
  );
};

export default AddDataContract;
