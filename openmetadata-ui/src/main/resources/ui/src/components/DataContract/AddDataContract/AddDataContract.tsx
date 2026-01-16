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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { ContractSchemaFormTab } from '../ContractSchemaFormTab/ContractScehmaFormTab';
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
  const entityContractTabs = useMemo(
    () => getDataContractTabByEntity(entityType),
    [entityType]
  );

  // Filter out inherited fields from the contract for editing
  // Inherited fields should not be shown in the edit form
  // IMPORTANT: We must completely REMOVE inherited fields from the object (not set to undefined)
  // so that fast-json-patch generates /add operations instead of /replace when adding new values
  const filteredContract = useMemo(() => {
    if (!contract) {
      return undefined;
    }

    // Helper to check if a field is inherited (handles generated types not having inherited yet)
    const isInherited = (
      field: unknown
    ): field is { inherited?: boolean; content?: string } => {
      return (
        typeof field === 'object' &&
        field !== null &&
        'inherited' in field &&
        (field as { inherited?: boolean }).inherited === true
      );
    };

    // Filter semantics to exclude inherited rules
    const filteredSemantics = contract.semantics?.filter((rule) => {
      const ruleWithInherited = rule as unknown as { inherited?: boolean };

      return !ruleWithInherited.inherited;
    });

      // Get termsOfUse, excluding if inherited
      // Keep the object format to maintain consistency with the API and form components
      let filteredTermsOfUse: string | { content?: string } | undefined;
      if (isInherited(contract.termsOfUse)) {
        filteredTermsOfUse = undefined;
      } else if (
        typeof contract.termsOfUse === 'object' &&
        contract.termsOfUse !== null
      ) {
        // Keep as object to maintain the new schema format
        filteredTermsOfUse = contract.termsOfUse as unknown as { content?: string };
      } else if (typeof contract.termsOfUse === 'string') {
        // Convert old string format to new object format for consistency
        filteredTermsOfUse = { content: contract.termsOfUse };
      }

    // Check security and SLA for inherited
    const securityWithInherited = contract.security as unknown as {
      inherited?: boolean;
    };
    const slaWithInherited = contract.sla as unknown as { inherited?: boolean };

    // Start with base contract fields, excluding potentially inherited fields
    // We destructure to exclude sla, security, termsOfUse, semantics, then add them back only if not inherited
    const {
      sla: _sla,
      security: _security,
      termsOfUse: _termsOfUse,
      semantics: _semantics,
      ...baseContract
    } = contract;

    // Build result object, only adding fields that are not inherited
    // This ensures fast-json-patch generates /add operations instead of /replace
    const result: Partial<DataContract> = {
      ...baseContract,
    };

    // Only add semantics if there are non-inherited rules
    if (filteredSemantics && filteredSemantics.length > 0) {
      result.semantics = filteredSemantics;
    }

    // Only add termsOfUse if not inherited
    if (filteredTermsOfUse !== undefined) {
      result.termsOfUse = filteredTermsOfUse;
    }

    // Only add security if not inherited
    if (!securityWithInherited?.inherited && contract.security) {
      result.security = contract.security;
    }

    // Only add SLA if not inherited
    if (!slaWithInherited?.inherited && contract.sla) {
      result.sla = contract.sla;
    }

    return result as DataContract;
  }, [contract]);

    const [formValues, setFormValues] = useState<DataContract>(
      filteredContract || ({} as DataContract)
    );

    useEffect(() => {
      setFormValues(filteredContract || ({} as DataContract));
    }, [filteredContract]);

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
      // Compare against filteredContract (without inherited fields) to avoid
      // generating "remove" operations for inherited fields
      isSaveDisabled: isEmpty(
        compare(filteredContract ?? {}, {
          ...filteredContract,
          ...formValues,
          semantics: validSemantics,
          security: validSecurity,
        })
      ),
    };
  }, [filteredContract, formValues]);

  const handleSave = useCallback(async () => {
    setIsSubmitting(true);

    try {
      if (contract) {
        // Use filteredContract for PATCH comparison to avoid generating
        // "remove" operations for inherited fields (SLA, security, terms, semantics)
        await updateContract(
          contract?.id,
          compare(filteredContract ?? {}, {
            ...filteredContract,
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
    filteredContract,
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
            initialValues={filteredContract}
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
            initialValues={filteredContract}
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
            selectedSchema={filteredContract?.schema ?? []}
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
            initialValues={filteredContract}
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
            initialValues={filteredContract}
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
              filteredContract?.qualityExpectations?.map(
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
            initialValues={filteredContract}
            onChange={onFormChange}
            onPrev={onPrev}
          />
        ),
      },
    ];

    return tabs.filter((tab) => entityContractTabs.includes(Number(tab.key)));
  }, [
    entityContractTabs,
    filteredContract,
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
