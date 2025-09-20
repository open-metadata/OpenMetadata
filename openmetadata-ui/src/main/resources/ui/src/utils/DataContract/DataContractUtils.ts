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
import yaml from 'js-yaml';
import { isEmpty, omit } from 'lodash';
import { ReactComponent as ContractAbortedIcon } from '../../assets/svg/ic-contract-aborted.svg';
import { ReactComponent as ContractFailedIcon } from '../../assets/svg/ic-contract-failed.svg';
import { ReactComponent as ContractRunningIcon } from '../../assets/svg/ic-contract-running.svg';
import { StatusType } from '../../components/common/StatusBadge/StatusBadge.interface';
import { SEMANTIC_OPERATORS } from '../../constants/DataContract.constants';
import { EntityReferenceFields } from '../../enums/AdvancedSearch.enum';
import { SearchIndex } from '../../enums/search.enum';
import { TestCaseType } from '../../enums/TestSuite.enum';
import {
  ContractExecutionStatus,
  DataContract,
} from '../../generated/entity/data/dataContract';
import { DataContractResult } from '../../generated/entity/datacontract/dataContractResult';
import { formatMonth } from '../date-time/DateTimeUtils';
import i18n, { t } from '../i18next/LocalUtil';
import jsonLogicSearchClassBase from '../JSONLogicSearchClassBase';

export const getContractStatusLabelBasedOnFailedResult = (failed?: number) => {
  return failed === 0 ? t('label.passed') : t('label.failed');
};

export const getConstraintStatus = (
  latestContractResults: DataContractResult
) => {
  const statusArray: Record<string, string> = {};

  // Add schema validation if it exists
  if (latestContractResults.schemaValidation) {
    statusArray['schema'] = getContractStatusLabelBasedOnFailedResult(
      latestContractResults.schemaValidation.failed
    );
  }

  // Add semantics validation if it exists
  if (latestContractResults.semanticsValidation) {
    statusArray['semantic'] = getContractStatusLabelBasedOnFailedResult(
      latestContractResults.semanticsValidation.failed
    );
  }

  // Add quality validation if it exists
  if (latestContractResults.qualityValidation) {
    statusArray['quality'] = getContractStatusLabelBasedOnFailedResult(
      latestContractResults.qualityValidation.failed
    );
  }

  return statusArray;
};

export const getContractStatusType = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'passed':
    case 'success':
      return StatusType.Success;
    case 'failed':
      return StatusType.Failure;
    case 'issue':
    case 'warning':
      return StatusType.Warning;
    default:
      return StatusType.Pending;
  }
};

//  since the value will be used in a PUT call and this API accept createDataContract object. so we are eliminating
//  the fields that are not present in the createDataContract object. And restricting name to be changed since
//  there will be only one contract per entity.
export const getUpdatedContractDetails = (
  contract: DataContract,
  formValues: DataContract
) => {
  return omit({ ...contract, ...formValues, name: contract?.name ?? '' }, [
    'id',
    'fullyQualifiedName',
    'version',
    'updatedAt',
    'updatedBy',
    'testSuite',
    'deleted',
    'changeDescription',
    'latestResult',
    'incrementalChangeDescription',
  ]);
};

export const downloadContractYamlFile = (contract: DataContract) => {
  const data = yaml.dump(getUpdatedContractDetails(contract, contract));
  const element = document.createElement('a');
  const file = new Blob([data], { type: 'text/plain' });
  element.textContent = 'download-file';
  element.href = URL.createObjectURL(file);
  element.download = `${contract.name}.yaml`;
  document.body.appendChild(element);
  element.click();

  URL.revokeObjectURL(element.href);
  document.body.removeChild(element);
};

export const getDataContractStatusIcon = (status: ContractExecutionStatus) => {
  switch (status) {
    case ContractExecutionStatus.Failed:
      return ContractFailedIcon;

    case ContractExecutionStatus.Aborted:
      return ContractAbortedIcon;

    case ContractExecutionStatus.Running:
      return ContractRunningIcon;

    default:
      return null;
  }
};

export const ContractTestTypeLabelMap = {
  [TestCaseType.all]: i18n.t('label.all'),
  [TestCaseType.table]: i18n.t('label.table'),
  [TestCaseType.column]: i18n.t('label.column'),
};

export const getSematicRuleFields = () => {
  const allFields = jsonLogicSearchClassBase.getCommonConfig();

  const tagField = {
    label: t('label.tag-plural'),
    type: '!group',
    mode: 'some',
    defaultField: 'tagFQN',
    subfields: {
      tagFQN: {
        label: 'Tags',
        type: 'select',
        mainWidgetProps: jsonLogicSearchClassBase.mainWidgetProps,
        operators: SEMANTIC_OPERATORS,
        fieldSettings: {
          asyncFetch: jsonLogicSearchClassBase.searchAutocomplete({
            searchIndex: SearchIndex.TAG,
            fieldName: 'fullyQualifiedName',
            fieldLabel: 'name',
            queryFilter:
              'NOT fullyQualifiedName:Certification.* AND NOT fullyQualifiedName:Tier.*',
          }),
          useAsyncSearch: true,
        },
      },
    },
  };

  const glossaryTermField = {
    label: t('label.glossary-term'),
    type: '!group',
    mode: 'some',
    fieldName: 'tags',
    defaultField: 'tagFQN',
    subfields: {
      tagFQN: {
        label: 'Tags',
        type: 'select',
        mainWidgetProps: jsonLogicSearchClassBase.mainWidgetProps,
        operators: SEMANTIC_OPERATORS,
        fieldSettings: {
          asyncFetch: jsonLogicSearchClassBase.searchAutocomplete({
            searchIndex: SearchIndex.GLOSSARY_TERM,
            fieldName: 'fullyQualifiedName',
            fieldLabel: 'name',
          }),
          useAsyncSearch: true,
        },
      },
    },
  };

  const tierField = {
    label: t('label.tier'),
    type: '!group',
    mode: 'some',
    fieldName: 'tags',
    defaultField: 'tagFQN',
    subfields: {
      tagFQN: {
        label: 'Tags',
        type: 'multiselect',
        mainWidgetProps: jsonLogicSearchClassBase.mainWidgetProps,
        operators: SEMANTIC_OPERATORS,
        fieldSettings: {
          asyncFetch: jsonLogicSearchClassBase.autoCompleteTier,
          useAsyncSearch: true,
          listValues: jsonLogicSearchClassBase.autoCompleteTier,
        },
      },
    },
  };

  delete allFields[EntityReferenceFields.EXTENSION];

  allFields[EntityReferenceFields.TAG] = tagField;
  allFields[EntityReferenceFields.GLOSSARY_TERM] = glossaryTermField;
  allFields[EntityReferenceFields.TIER] = tierField;

  return allFields;
};

// Create month ticks at regular intervals
export const getContractExecutionMonthTicks = (
  data: {
    name: number;
    failed: number;
    success: number;
    aborted: number;
  }[]
) => {
  if (isEmpty(data)) {
    return [];
  }

  // Group data by month and find the first occurrence of each month
  const monthMap = new Map<string, number>();

  data.forEach((item) => {
    const month = formatMonth(item.name);
    // Only add if we haven't seen this month before (keeps the earliest timestamp)
    if (!monthMap.has(month)) {
      monthMap.set(month, item.name);
    }
  });

  return Array.from(monthMap.values());
};

// Utility function to convert string enum to options array for Ant Design Select
export const enumToSelectOptions = <T extends Record<string, string>>(
  enumObject: T
): Array<{ label: string; value: string }> => {
  return Object.values(enumObject).map((value) => ({
    label: t(`label.${value}`),
    value: value, // Use the enum value as the actual value (hour, day, week, etc.)
  }));
};
