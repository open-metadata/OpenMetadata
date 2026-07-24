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
import { RuleObject } from 'antd/lib/form';
import yaml from 'js-yaml';
import { isEmpty, omit } from 'lodash';
import { ReactComponent as ContractAbortedIcon } from '../../assets/svg/ic-contract-aborted.svg';
import { ReactComponent as ContractFailedIcon } from '../../assets/svg/ic-contract-failed.svg';
import { ReactComponent as ContractRunningIcon } from '../../assets/svg/ic-contract-running.svg';
import { StatusType } from '../../components/common/StatusBadge/StatusBadge.interface';
import { DataContractProcessedResultCharts } from '../../components/DataContract/ContractExecutionChart/ContractExecutionChart.interface';
import {
  EDataContractTab,
  SEMANTIC_TAG_OPERATORS,
} from '../../constants/DataContract.constants';
import { EntityReferenceFields } from '../../enums/AdvancedSearch.enum';
import { EntityType } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { TestCaseType } from '../../enums/TestSuite.enum';
import {
  ContractExecutionStatus,
  DataContract,
  SemanticsRule,
} from '../../generated/entity/data/dataContract';
import { DataContractResult } from '../../generated/entity/datacontract/dataContractResult';
import { formatMonth } from '../date-time/DateTimeUtils';
import i18n, { t } from '../i18next/LocalUtil';
import jsonLogicSearchClassBase from '../JSONLogicSearchClassBase';
import { getTermQuery } from '../SearchPureUtils';

export const semanticRuleValidator = (_: RuleObject, value: string) => {
  if (isEmpty(value) || value === '""' || value === '{}') {
    return Promise.reject(
      new Error(
        t('message.field-text-is-required', {
          fieldText: t('label.rule'),
        })
      )
    );
  }

  return Promise.resolve();
};

interface QueryBuilderTreeNode {
  properties?: { field?: string; operator?: string };
  children1?: QueryBuilderTreeNode[] | Record<string, QueryBuilderTreeNode>;
}

// Confirms, from the persisted query-builder tree, that a field's `==null`
// JsonLogic condition really came from the "Is Not Set" operator rather than
// a hand-authored rule using the same shape with different intent.
export const isFieldUsingIsNullOperator = (
  jsonTree: string | undefined,
  field: string
): boolean => {
  if (!jsonTree) {
    return false;
  }

  let found = false;
  try {
    const nodes: QueryBuilderTreeNode[] = [JSON.parse(jsonTree)];
    while (nodes.length > 0 && !found) {
      const node = nodes.pop();
      const children = node?.children1;
      found =
        node?.properties?.field === field &&
        node?.properties?.operator === 'is_null';
      if (Array.isArray(children)) {
        nodes.push(...children);
      } else if (children && typeof children === 'object') {
        nodes.push(...Object.values(children));
      }
    }
  } catch {
    found = false;
  }

  return found;
};

// Counts, per field, how many "Is Not Set" (is_null) nodes the persisted
// query-builder tree actually has. Used to build a one-shot confirmation
// callback below: a field name alone can't disambiguate two sibling
// conditions on the same field (e.g. an "Is Not Set" rule alongside an
// unrelated hand-authored `==null` rule on that same field), but consuming
// one is_null occurrence per rewrite keeps the rewrite count from exceeding
// the number of confirmed is_null nodes in the tree.
const countIsNullNodesByField = (
  jsonTree: string | undefined
): Map<string, number> => {
  const counts = new Map<string, number>();
  if (!jsonTree) {
    return counts;
  }
  try {
    const nodes: QueryBuilderTreeNode[] = [JSON.parse(jsonTree)];
    while (nodes.length > 0) {
      const node = nodes.pop();
      const field = node?.properties?.field;
      if (field && node?.properties?.operator === 'is_null') {
        counts.set(field, (counts.get(field) ?? 0) + 1);
      }
      const children = node?.children1;
      if (Array.isArray(children)) {
        nodes.push(...children);
      } else if (children && typeof children === 'object') {
        nodes.push(...Object.values(children));
      }
    }
  } catch {
    // Malformed tree: treat as no confirmed is_null nodes.
  }

  return counts;
};

// Builds a confirmation callback for getNegativeQueryForNotContainsReverserOperation
// that consumes one is_null occurrence per field as it confirms rewrites,
// so at most as many `==null` nodes are rewritten per field as the tree
// actually confirms came from the "Is Not Set" operator.
export const createIsNullFieldConfirmation = (
  jsonTree: string | undefined
): ((field: string) => boolean) => {
  const remainingByField = countIsNullNodesByField(jsonTree);

  return (field: string): boolean => {
    const remaining = remainingByField.get(field) ?? 0;
    if (remaining <= 0) {
      return false;
    }
    remainingByField.set(field, remaining - 1);

    return true;
  };
};

// Normalizes persisted semantic rules so contracts saved before the
// negation-lift rewrite don't stay broken on validation. Only rewrites a
// field's `==null` shape when the persisted tree confirms it came from the
// "Is Not Set" operator, to avoid corrupting a differently-intended rule
// that happens to share the same JsonLogic AST shape.
export const getNormalizedContractSemantics = (
  semantics?: SemanticsRule[]
): SemanticsRule[] | undefined => {
  return semantics?.map((item) => {
    if (!item.rule) {
      return item;
    }
    try {
      const normalized =
        jsonLogicSearchClassBase.getNegativeQueryForNotContainsReverserOperation(
          JSON.parse(item.rule),
          createIsNullFieldConfirmation(item.jsonTree)
        );

      return { ...item, rule: JSON.stringify(normalized) };
    } catch {
      return item;
    }
  });
};

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
  const merged: Record<string, unknown> = {
    ...contract,
    ...formValues,
    name: contract?.name ?? '',
  };

  // Convert termsOfUse from object {content, inherited} to plain string (CreateDataContract format)
  if (
    merged.termsOfUse &&
    typeof merged.termsOfUse === 'object' &&
    'content' in merged.termsOfUse
  ) {
    merged.termsOfUse = (merged.termsOfUse as { content?: string }).content;
  }

  return omit(merged, [
    'id',
    'fullyQualifiedName',
    'version',
    'updatedAt',
    'updatedBy',
    'createdAt',
    'createdBy',
    'href',
    'contractUpdates',
    'inherited',
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

export const downloadContractAsODCSYaml = (
  yamlContent: string,
  contractName: string
) => {
  const element = document.createElement('a');
  const file = new Blob([yamlContent], { type: 'application/yaml' });
  element.textContent = 'download-file';
  element.href = URL.createObjectURL(file);
  element.download = `${contractName}.odcs.yaml`;
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

export const getContractTabLabel = (tabKey: EDataContractTab): string => {
  switch (tabKey) {
    case EDataContractTab.TERMS_OF_SERVICE:
      return i18n.t('label.terms-of-service');
    case EDataContractTab.SCHEMA:
      return i18n.t('label.schema');
    case EDataContractTab.SEMANTICS:
      return i18n.t('label.semantic-plural');
    case EDataContractTab.QUALITY:
      return i18n.t('label.quality');
    case EDataContractTab.SECURITY:
      return i18n.t('label.security');
    case EDataContractTab.SLA:
      return i18n.t('label.sla');

    default:
      return i18n.t('label.contract-detail-plural');
  }
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
        type: 'multiselect',
        defaultOperator: 'array_contains',
        mainWidgetProps: jsonLogicSearchClassBase.mainWidgetProps,
        operators: SEMANTIC_TAG_OPERATORS,
        fieldSettings: {
          asyncFetch: jsonLogicSearchClassBase.searchAutocomplete({
            searchIndex: SearchIndex.TAG,
            fieldName: 'fullyQualifiedName',
            fieldLabel: 'name',
            queryFilter: getTermQuery({}, 'must_not', undefined, {
              wildcardMustNotQueries: {
                fullyQualifiedName: ['Certification.*', 'Tier.*'],
              },
            }),
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
        type: 'multiselect',
        defaultOperator: 'array_contains',
        mainWidgetProps: jsonLogicSearchClassBase.mainWidgetProps,
        operators: SEMANTIC_TAG_OPERATORS,
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
        defaultOperator: 'array_contains',
        mainWidgetProps: jsonLogicSearchClassBase.mainWidgetProps,
        operators: SEMANTIC_TAG_OPERATORS,
        fieldSettings: {
          asyncFetch: jsonLogicSearchClassBase.autoCompleteTier,
          useAsyncSearch: true,
          listValues: jsonLogicSearchClassBase.autoCompleteTier,
        },
      },
    },
  };

  delete allFields[EntityReferenceFields.EXTENSION];
  delete allFields[EntityReferenceFields.SERVICE];
  delete allFields[EntityReferenceFields.NAME];

  allFields[EntityReferenceFields.TAG] = tagField;
  allFields[EntityReferenceFields.GLOSSARY_TERM] = glossaryTermField;
  allFields[EntityReferenceFields.TIER] = tierField;

  return allFields;
};

export const processContractExecutionData = (
  executionData: DataContractResult[]
): DataContractProcessedResultCharts[] => {
  return executionData.map((item, index) => {
    // Add a unique identifier to distinguish items with same timestamp
    const uniqueName = `${item.timestamp}_${index}`;
    const status = item.contractExecutionStatus;

    return {
      name: uniqueName, // Use unique identifier for positioning
      displayTimestamp: item.timestamp, // Keep original timestamp for display
      value: 1, // Always 1 for the bar height
      status: status, // Store status for color determination
      failed: status === ContractExecutionStatus.Failed ? 1 : 0,
      success: status === ContractExecutionStatus.Success ? 1 : 0,
      aborted: status === ContractExecutionStatus.Aborted ? 1 : 0,
      running: status === ContractExecutionStatus.Running ? 1 : 0,
      data: item,
    };
  });
};

// Create custom scale function for positioning bars from left
export const createContractExecutionCustomScale = (
  data: DataContractProcessedResultCharts[]
) => {
  const domainValues = data.map((d) => d.name);
  let rangeValues = [0, 800];

  const scale = (value: string) => {
    const index = data.findIndex((item) => item.name === value);
    if (index === -1) {
      return 0;
    }

    // Calculate position starting from the left edge
    const maxBarWidth = 20; // Wider bars for better visibility
    const spacing = 8; // More spacing between bars
    const position = rangeValues[0] + index * (maxBarWidth + spacing);

    return position;
  };

  // Implement chainable methods like d3-scale
  scale.domain = (domain?: string[]) => {
    if (domain === undefined) {
      return domainValues;
    }

    return scale;
  };

  scale.range = (range?: number[]) => {
    if (range === undefined) {
      return rangeValues;
    }
    rangeValues = range;

    return scale;
  };

  scale.ticks = () => [];
  scale.tickFormat = () => formatMonth;
  scale.bandwidth = () => 20; // Match the maxBarWidth
  scale.copy = () => createContractExecutionCustomScale(data);
  scale.nice = () => scale;
  scale.type = 'band';

  return scale;
};

// Generate tick positions for month labels
export const generateMonthTickPositions = (
  processedData: DataContractProcessedResultCharts[]
) => {
  const uniqueMonths = new Set();
  const tickPositions: string[] = [];

  for (const item of processedData) {
    const monthKey = new Date(item.displayTimestamp).toISOString().slice(0, 7); // YYYY-MM format
    if (!uniqueMonths.has(monthKey)) {
      uniqueMonths.add(monthKey);
      // Use the first occurrence of each month as the tick position
      tickPositions.push(item.name); // Use the unique name for the tick
    }
  }

  return tickPositions;
};

// Format tick value for month display
export const formatContractExecutionTick = (value: string) => {
  // Extract timestamp from the unique name (format: timestamp_index)
  const timestamp = value.split('_')[0];

  return formatMonth(Number(timestamp));
};

// Utility function to convert string to options array for Ant Design Select
export const generateSelectOptionsFromString = (
  arrayItems: string[]
): Array<{ label: string; value: string }> => {
  return arrayItems.map((value) => ({
    label: t(`label.${value}`),
    value: value, // Use the string value as the actual value (hour, day, week, etc.)
  }));
};

export const getDataContractTabByEntity = (entityType: EntityType) => {
  switch (entityType) {
    case EntityType.TABLE:
      return [
        EDataContractTab.CONTRACT_DETAIL,
        EDataContractTab.TERMS_OF_SERVICE,
        EDataContractTab.SCHEMA,
        EDataContractTab.SEMANTICS,
        EDataContractTab.SECURITY,
        EDataContractTab.QUALITY,
        EDataContractTab.SLA,
      ];
    case EntityType.TOPIC:
    case EntityType.API_ENDPOINT:
    case EntityType.DASHBOARD_DATA_MODEL:
      return [
        EDataContractTab.CONTRACT_DETAIL,
        EDataContractTab.TERMS_OF_SERVICE,
        EDataContractTab.SCHEMA,
        EDataContractTab.SEMANTICS,
        EDataContractTab.SECURITY,
        EDataContractTab.SLA,
      ];
    case EntityType.DATA_PRODUCT:
      return [
        EDataContractTab.CONTRACT_DETAIL,
        EDataContractTab.TERMS_OF_SERVICE,
        EDataContractTab.SEMANTICS,
        EDataContractTab.SECURITY,
        EDataContractTab.SLA,
      ];

    default:
      return [
        EDataContractTab.CONTRACT_DETAIL,
        EDataContractTab.TERMS_OF_SERVICE,
        EDataContractTab.SEMANTICS,
        EDataContractTab.SECURITY,
        EDataContractTab.SLA,
      ];
  }
};
