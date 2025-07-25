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
  Radio,
  RadioChangeEvent,
  Tabs,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EDataContractTab } from '../../../constants/DataContract.constants';
import { CSMode } from '../../../enums/codemirror.enum';
import { EntityType } from '../../../enums/entity.enum';
import { DataContract } from '../../../generated/entity/data/dataContract';
import { Table } from '../../../generated/entity/data/table';
import { createContract, updateContract } from '../../../rest/contractAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
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

const AddDataContract: React.FC<{
  onCancel: () => void;
  onSave: () => void;
  contract?: DataContract;
}> = ({ onCancel, onSave, contract }) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'YAML' | 'UI'>('UI');
  const [yaml, setYaml] = useState('');
  const [activeTab, setActiveTab] = useState(
    EDataContractTab.CONTRACT_DETAIL.toString()
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: table } = useGenericContext<Table>();

  const [formValues, setFormValues] = useState<DataContract>(
    contract || ({} as DataContract)
  );

  const handleTabChange = useCallback((key: string) => {
    setActiveTab(key);
  }, []);

  const handleSave = useCallback(async () => {
    setIsSubmitting(true);

    try {
      await (contract
        ? updateContract({ ...contract, ...formValues } as DataContract)
        : createContract({
            ...formValues,
            entity: {
              id: table.id,
              type: EntityType.TABLE,
            },
          }));

      showSuccessToast(t('message.data-contract-saved-successfully'));
      onSave();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSubmitting(false);
    }
  }, [t, contract, formValues]);

  const onNext = useCallback(
    async (data: Partial<DataContract>) => {
      setFormValues((prev) => ({ ...prev, ...data }));

      setActiveTab((prev) => (Number(prev) + 1).toString());
    },
    [activeTab, t, handleSave]
  );

  const onPrev = useCallback(() => {
    setActiveTab((prev) => (Number(prev) - 1).toString());
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
        key: EDataContractTab.CONTRACT_DETAIL.toString(),
        children: (
          <ContractDetailFormTab
            nextLabel={t('label.schema')}
            onNext={onNext}
          />
        ),
      },
      {
        label: (
          <div className="d-flex items-center">
            <TableOutlined />
            <span>{t('label.schema')}</span>
          </div>
        ),
        key: EDataContractTab.SCHEMA.toString(),
        children: (
          <ContractSchemaFormTab
            nextLabel={t('label.semantic-plural')}
            prevLabel={t('label.contract-detail-plural')}
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
        key: EDataContractTab.SEMANTICS.toString(),
        children: (
          <ContractSemanticFormTab
            nextLabel={t('label.quality')}
            prevLabel={t('label.schema')}
            onNext={onNext}
            onPrev={onPrev}
          />
        ),
      },
      {
        label: (
          <div className="d-flex items-center">
            <TableOutlined />
            <span>{t('label.quality')}</span>
          </div>
        ),
        key: EDataContractTab.QUALITY.toString(),
        children: (
          <ContractQualityFormTab
            prevLabel={t('label.semantic-plural')}
            onPrev={onPrev}
            onUpdate={(partialDataContract) =>
              setFormValues((prev) => ({ ...prev, ...partialDataContract }))
            }
          />
        ),
      },
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
        activeKey={activeTab.toString()}
        className="contract-tabs"
        items={items}
        tabPosition="left"
        onChange={handleTabChange}
      />
    );
  }, [mode, items, handleTabChange, activeTab, yaml]);

  return <Card title={cardTitle}>{cardContent}</Card>;
};

export default AddDataContract;
