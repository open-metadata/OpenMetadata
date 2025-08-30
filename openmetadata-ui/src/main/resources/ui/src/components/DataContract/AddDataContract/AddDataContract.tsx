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
import { ReactComponent as TableIcon } from '../../../assets/svg/table-outline.svg';
import {
  DataContractMode,
  EDataContractTab,
  SUPPORTED_CONTRACT_TAB,
} from '../../../constants/DataContract.constants';
import { CSMode } from '../../../enums/codemirror.enum';
import { EntityType } from '../../../enums/entity.enum';
import {
  ContractStatus,
  DataContract,
} from '../../../generated/entity/data/dataContract';
import { Table } from '../../../generated/entity/data/table';
import { createContract, updateContract } from '../../../rest/contractAPI';
import {
  getContractTabLabel,
  getUpdatedContractDetails,
} from '../../../utils/DataContract/DataContractUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: entityData } = useGenericContext<Table>();
  const { entityType } = useRequiredParams<{ entityType: EntityType }>();
  const [formValues, setFormValues] = useState<DataContract>(
    contract || ({} as DataContract)
  );

  const entityContractTab = useMemo(
    () =>
      SUPPORTED_CONTRACT_TAB[entityType as keyof typeof SUPPORTED_CONTRACT_TAB],
    [entityType]
  );

  const [activeTab, setActiveTab] = useState(
    entityContractTab[0]?.toString() ||
      EDataContractTab.CONTRACT_DETAIL.toString()
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
              id: entityData.id,
              type: entityType,
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
  }, [contract, formValues, entityData.id, entityType]);

  const onFormChange = useCallback(
    (data: Partial<DataContract>) => {
      setFormValues((prev) => ({ ...prev, ...data }));
    },
    [setFormValues]
  );

  const currentActiveTabIndex = useMemo(
    () => entityContractTab.findIndex((tab) => tab.toString() === activeTab),
    [entityContractTab, activeTab]
  );

  const onNext = useCallback(async () => {
    if (
      currentActiveTabIndex !== -1 &&
      currentActiveTabIndex < entityContractTab.length - 1
    ) {
      setActiveTab(entityContractTab[currentActiveTabIndex + 1].toString());
    }
  }, [setActiveTab, currentActiveTabIndex, entityContractTab]);

  const onPrev = useCallback(() => {
    if (currentActiveTabIndex > 0) {
      setActiveTab(entityContractTab[currentActiveTabIndex - 1].toString());
    }
  }, [setActiveTab, currentActiveTabIndex, entityContractTab]);

  // Optimized helper functions using single index calculation
  const currentTabInfo = useMemo(() => {
    return {
      hasNext:
        currentActiveTabIndex !== -1 &&
        currentActiveTabIndex < entityContractTab.length - 1,
      nextTabLabel:
        currentActiveTabIndex !== -1 &&
        currentActiveTabIndex < entityContractTab.length - 1
          ? getContractTabLabel(entityContractTab[currentActiveTabIndex + 1])
          : '',
      prevTabLabel:
        currentActiveTabIndex > 0
          ? getContractTabLabel(entityContractTab[currentActiveTabIndex - 1])
          : '',
    };
  }, [currentActiveTabIndex, entityContractTab]);

  const items = useMemo(() => {
    const tabs = [
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
            isNextVisible={currentTabInfo.hasNext}
            nextLabel={currentTabInfo.nextTabLabel}
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
            isNextVisible={currentTabInfo.hasNext}
            nextLabel={currentTabInfo.nextTabLabel}
            prevLabel={currentTabInfo.prevTabLabel}
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
            isNextVisible={currentTabInfo.hasNext}
            nextLabel={currentTabInfo.nextTabLabel}
            prevLabel={currentTabInfo.prevTabLabel}
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
            prevLabel={currentTabInfo.prevTabLabel}
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
    ];

    return tabs.filter((tab) => entityContractTab.includes(Number(tab.key)));
  }, [
    entityContractTab,
    contract,
    onFormChange,
    onNext,
    onPrev,
    currentTabInfo,
  ]);

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
          <Button
            className="add-contract-cancel-button"
            type="default"
            onClick={onCancel}>
            {t('label.cancel')}
          </Button>
          <Button
            className="add-contract-save-button"
            data-testid="save-contract-btn"
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
    <Card
      className="add-contract-card"
      data-testid="add-contract-card"
      title={cardTitle}>
      {cardContent}
    </Card>
  );
};

export default AddDataContract;
