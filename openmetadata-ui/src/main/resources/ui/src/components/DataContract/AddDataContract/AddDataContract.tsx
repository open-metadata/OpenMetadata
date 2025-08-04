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

import { Button, Card, RadioChangeEvent, Tabs, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ContractIcon } from '../../../assets/svg/ic-contract.svg';
import { ReactComponent as QualityIcon } from '../../../assets/svg/policies.svg';
import { ReactComponent as SemanticsIcon } from '../../../assets/svg/semantics.svg';
import { ReactComponent as TableIcon } from '../../../assets/svg/table-grey.svg';
import {
  DataContractMode,
  EDataContractTab,
} from '../../../constants/DataContract.constants';
import { CSMode } from '../../../enums/codemirror.enum';
import { EntityType } from '../../../enums/entity.enum';
import {
  ContractStatus,
  DataContract,
} from '../../../generated/entity/data/dataContract';
import { Table } from '../../../generated/entity/data/table';
import { createContract, updateContract } from '../../../rest/contractAPI';
import { getUpdatedContractDetails } from '../../../utils/DataContract/DataContractUtils';
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
  const [mode, setMode] = useState<DataContractMode>(DataContractMode.UI);
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

    const validSemantics = formValues.semantics?.filter(
      (semantic) => !isEmpty(semantic.name) && !isEmpty(semantic.rule)
    );

    try {
      await (contract
        ? updateContract({
            ...getUpdatedContractDetails(contract, formValues),
            semantics: validSemantics,
          })
        : createContract({
            ...formValues,
            entity: {
              id: table.id,
              type: EntityType.TABLE,
            },
            semantics: validSemantics,
            status: ContractStatus.Active,
          }));

      showSuccessToast(t('message.data-contract-saved-successfully'));
      onSave();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSubmitting(false);
    }
  }, [contract, formValues, table.id]);

  const onFormChange = useCallback(
    (data: Partial<DataContract>) => {
      setFormValues((prev) => ({ ...prev, ...data }));
    },
    [setFormValues]
  );

  const onNext = useCallback(async () => {
    setActiveTab((prev) => (Number(prev) + 1).toString());
  }, [setActiveTab]);

  const onPrev = useCallback(() => {
    setActiveTab((prev) => (Number(prev) - 1).toString());
  }, [setActiveTab]);

  const items = useMemo(
    () => [
      {
        label: (
          <div className="d-flex items-center">
            <ContractIcon className="contract-tab-icon" />
            <span>{t('label.contract-detail-plural')}</span>
          </div>
        ),
        key: EDataContractTab.CONTRACT_DETAIL.toString(),
        children: (
          <ContractDetailFormTab
            initialValues={contract}
            nextLabel={t('label.schema')}
            onChange={onFormChange}
            onNext={onNext}
          />
        ),
      },
      {
        label: (
          <div className="d-flex items-center">
            <TableIcon className="contract-tab-icon" />
            <span>{t('label.schema')}</span>
          </div>
        ),
        key: EDataContractTab.SCHEMA.toString(),
        children: (
          <ContractSchemaFormTab
            nextLabel={t('label.semantic-plural')}
            prevLabel={t('label.contract-detail-plural')}
            selectedSchema={
              contract?.schema?.map((column) => column.name) || []
            }
            onChange={onFormChange}
            onNext={onNext}
            onPrev={onPrev}
          />
        ),
      },
      {
        label: (
          <div className="d-flex items-center">
            <SemanticsIcon className="contract-tab-icon" />
            <span>{t('label.semantic-plural')}</span>
          </div>
        ),
        key: EDataContractTab.SEMANTICS.toString(),
        children: (
          <ContractSemanticFormTab
            initialValues={contract}
            nextLabel={t('label.quality')}
            prevLabel={t('label.schema')}
            onChange={onFormChange}
            onNext={onNext}
            onPrev={onPrev}
          />
        ),
      },
      {
        label: (
          <div className="d-flex items-center">
            <QualityIcon className="contract-tab-icon" />
            <span>{t('label.quality')}</span>
          </div>
        ),
        key: EDataContractTab.QUALITY.toString(),
        children: (
          <ContractQualityFormTab
            prevLabel={t('label.semantic-plural')}
            selectedQuality={
              contract?.qualityExpectations?.map(
                (quality) => quality.id ?? ''
              ) ?? []
            }
            onChange={onFormChange}
            onPrev={onPrev}
          />
        ),
      },
    ],
    [contract, onFormChange, onNext, onPrev]
  );

  const handleModeChange = useCallback((e: RadioChangeEvent) => {
    setMode(e.target.value);
  }, []);

  const cardTitle = useMemo(() => {
    return (
      <div className="add-contract-card-header d-flex items-center justify-between">
        <div>
          <Typography.Text className="add-contract-card-title">
            {t('label.add-contract-detail-plural')}
          </Typography.Text>
          <Typography.Paragraph className="add-contract-card-description">
            {t('message.add-contract-detail-description')}
          </Typography.Paragraph>
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
  }, [mode, handleModeChange, onCancel, handleSave, isSubmitting]);

  const cardContent = useMemo(() => {
    if (mode === DataContractMode.YAML) {
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

  return (
    <Card className="add-contract-card" title={cardTitle}>
      {cardContent}
    </Card>
  );
};

export default AddDataContract;
