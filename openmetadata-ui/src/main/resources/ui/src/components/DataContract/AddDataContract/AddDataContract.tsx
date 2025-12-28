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
import { compare } from 'fast-json-patch';
import { isEmpty } from 'lodash';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ContractIcon } from '../../../assets/svg/ic-contract.svg';
import { ReactComponent as SecurityIcon } from '../../../assets/svg/ic-security.svg';
import { ReactComponent as TermsIcon } from '../../../assets/svg/icon-test-suite.svg';
import { ReactComponent as QualityIcon } from '../../../assets/svg/policies.svg';
import { ReactComponent as SemanticsIcon } from '../../../assets/svg/semantics.svg';
import { ReactComponent as TableIcon } from '../../../assets/svg/table-outline.svg';
import { ReactComponent as SLAIcon } from '../../../assets/svg/timeout.svg';
import {
  DataContractMode,
  EDataContractTab,
} from '../../../constants/DataContract.constants';
import { CSMode } from '../../../enums/codemirror.enum';
import { EntityType } from '../../../enums/entity.enum';
import {
  DataContract,
  EntityStatus,
} from '../../../generated/entity/data/dataContract';
import { Table } from '../../../generated/entity/data/table';
import { createContract, updateContract } from '../../../rest/contractAPI';
import {
  getContractTabLabel,
  getDataContractTabByEntity,
} from '../../../utils/DataContract/DataContractUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import SchemaEditor from '../../Database/SchemaEditor/SchemaEditor';
import { ContractDetailFormTab } from '../ContractDetailFormTab/ContractDetailFormTab';
import { ContractQualityFormTab } from '../ContractQualityFormTab/ContractQualityFormTab';
import { ContractSchemaFormTab } from '../ContractSchemaFormTab/ContractSchemaFormTab';
import { ContractSecurityFormTab } from '../ContractSecurityFormTab/ContractSecurityFormTab';
import { ContractSemanticFormTab } from '../ContractSemanticFormTab/ContractSemanticFormTab';
import { ContractSLAFormTab } from '../ContractSLAFormTab/ContractSLAFormTab';
import ContractTermsOfService from '../ContractTermOfService/ContractTermsOfService.component';
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

  const entityContractTabs = useMemo(
    () => getDataContractTabByEntity(entityType),
    [entityType]
  );

  const [activeTab, setActiveTab] = useState(
    entityContractTabs[0]?.toString() ||
    EDataContractTab.CONTRACT_DETAIL.toString()
  );

  const handleTabChange = useCallback((key: string) => {
    setActiveTab(key);
  }, []);

  const { validSemantics, validSecurity, isSaveDisabled } = useMemo(() => {
    const validSemantics = formValues.semantics?.filter(
      (semantic) => !isEmpty(semantic.name) && !isEmpty(semantic.rule)
    );

    const validSecurity = formValues.security
      ? {
        ...formValues.security,
        policies: formValues.security.policies?.map((policy) => ({
          ...policy,
          rowFilters: policy.rowFilters?.filter(
            (filter) =>
              !isEmpty(filter?.columnName) && !isEmpty(filter?.values)
          ),
        })),
      }
      : undefined;

    return {
      validSemantics,
      validSecurity,
      isSaveDisabled: isEmpty(
        compare(contract ?? {}, {
          ...contract,
          ...formValues,
          semantics: validSemantics,
          security: validSecurity,
        })
      ),
    };
  }, [contract, formValues]);

  const handleSave = useCallback(async () => {
    setIsSubmitting(true);

    try {
      if (contract) {
        await updateContract(
          contract?.id,
          compare(contract, {
            ...contract,
            ...formValues,
            semantics: validSemantics,
            security: validSecurity,
            displayName: formValues.name,
          })
        );
      } else {
        await createContract({
          ...formValues,
          displayName: formValues.name,
          entity: {
            id: entityData.id,
            type: entityType,
          },
          semantics: validSemantics,
          security: validSecurity,
          entityStatus: EntityStatus.Approved,
        });
      }

      showSuccessToast(t('message.data-contract-saved-successfully'));
      onSave();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    contract,
    formValues,
    entityData.id,
    entityType,
    validSemantics,
    validSecurity,
  ]);

  const onFormChange = useCallback(
    (data: Partial<DataContract>) => {
      setFormValues((prev) => ({ ...prev, ...data }));
    },
    [setFormValues]
  );

  const currentActiveTabIndex = useMemo(
    () => entityContractTabs.findIndex((tab) => tab.toString() === activeTab),
    [entityContractTabs, activeTab]
  );

  const onNext = useCallback(async () => {
    if (
      currentActiveTabIndex !== -1 &&
      currentActiveTabIndex < entityContractTabs.length - 1
    ) {
      setActiveTab(entityContractTabs[currentActiveTabIndex + 1].toString());
    }
  }, [setActiveTab, currentActiveTabIndex, entityContractTabs]);

  const onPrev = useCallback(() => {
    if (currentActiveTabIndex > 0) {
      setActiveTab(entityContractTabs[currentActiveTabIndex - 1].toString());
    }
  }, [setActiveTab, currentActiveTabIndex, entityContractTabs]);

  // Optimized helper functions using single index calculation
  const currentTabInfo = useMemo(() => {
    return {
      hasNext:
        currentActiveTabIndex !== -1 &&
        currentActiveTabIndex < entityContractTabs.length - 1,
      nextTabLabel:
        currentActiveTabIndex !== -1 &&
          currentActiveTabIndex < entityContractTabs.length - 1
          ? getContractTabLabel(entityContractTabs[currentActiveTabIndex + 1])
          : '',
      prevTabLabel:
        currentActiveTabIndex > 0
          ? getContractTabLabel(entityContractTabs[currentActiveTabIndex - 1])
          : '',
    };
  }, [currentActiveTabIndex, entityContractTabs]);

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
            buttonProps={{
              isNextVisible: currentTabInfo.hasNext,
              nextLabel: currentTabInfo.nextTabLabel,
            }}
            initialValues={contract}
            onChange={onFormChange}
            onNext={onNext}
          />
        ),
      },
      {
        label: (
          <div className="d-flex items-center">
            <TermsIcon className="contract-tab-icon" />
            <span>{t('label.terms-of-service')}</span>
          </div>
        ),
        key: EDataContractTab.TERMS_OF_SERVICE.toString(),
        children: (
          <ContractTermsOfService
            buttonProps={{
              isNextVisible: currentTabInfo.hasNext,
              nextLabel: currentTabInfo.nextTabLabel,
              prevLabel: currentTabInfo.prevTabLabel,
            }}
            initialValues={contract}
            onChange={onFormChange}
            onNext={onNext}
            onPrev={onPrev}
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
            buttonProps={{
              isNextVisible: currentTabInfo.hasNext,
              nextLabel: currentTabInfo.nextTabLabel,
              prevLabel: currentTabInfo.prevTabLabel,
            }}
            selectedSchema={contract?.schema ?? []}
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
            buttonProps={{
              isNextVisible: currentTabInfo.hasNext,
              nextLabel: currentTabInfo.nextTabLabel,
              prevLabel: currentTabInfo.prevTabLabel,
            }}
            initialValues={contract}
            onChange={onFormChange}
            onNext={onNext}
            onPrev={onPrev}
          />
        ),
      },
      {
        label: (
          <div className="d-flex items-center">
            <SecurityIcon className="contract-tab-icon" />
            <span>{t('label.security')}</span>
          </div>
        ),
        key: EDataContractTab.SECURITY.toString(),
        children: (
          <ContractSecurityFormTab
            buttonProps={{
              isNextVisible: currentTabInfo.hasNext,
              nextLabel: currentTabInfo.nextTabLabel,
              prevLabel: currentTabInfo.prevTabLabel,
            }}
            initialValues={contract}
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
            buttonProps={{
              isNextVisible: currentTabInfo.hasNext,
              nextLabel: currentTabInfo.nextTabLabel,
              prevLabel: currentTabInfo.prevTabLabel,
            }}
            selectedQuality={
              contract?.qualityExpectations?.map(
                (quality) => quality.id ?? ''
              ) ?? []
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
            <SLAIcon className="contract-tab-icon" />
            <span>{t('label.sla')}</span>
          </div>
        ),
        key: EDataContractTab.SLA.toString(),
        children: (
          <ContractSLAFormTab
            buttonProps={{
              isNextVisible: currentTabInfo.hasNext,
              nextLabel: currentTabInfo.nextTabLabel,
              prevLabel: currentTabInfo.prevTabLabel,
            }}
            initialValues={contract}
            onChange={onFormChange}
            onPrev={onPrev}
          />
        ),
      },
    ];

    return tabs.filter((tab) => entityContractTabs.includes(Number(tab.key)));
  }, [
    entityContractTabs,
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
            disabled={isSaveDisabled}
            loading={isSubmitting}
            type="primary"
            onClick={handleSave}>
            {t('label.save')}
          </Button>
        </div>
      </div>
    );
  }, [
    mode,
    isSubmitting,
    isSaveDisabled,
    handleModeChange,
    onCancel,
    handleSave,
  ]);

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
