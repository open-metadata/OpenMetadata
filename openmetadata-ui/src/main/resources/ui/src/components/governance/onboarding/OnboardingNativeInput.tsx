/*
 *  Copyright 2026 Collate.
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
import {
  Box,
  Input,
  Select,
  TextArea,
  Typography,
} from '@openmetadata/ui-core-components';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { SearchIndex } from '../../../enums/search.enum';
import {
  MetricGranularity,
  MetricType,
  UnitOfMeasurement,
} from '../../../generated/api/data/createMetric';
import {
  DataProductType,
  PortfolioPriority,
  Visibility,
} from '../../../generated/api/domains/createDataProduct';
import { DomainType } from '../../../generated/api/domains/createDomain';
import { EntityReference } from '../../../generated/type/entityReference';
import { LabelType, State, TagSource } from '../../../generated/type/tagLabel';
import { isRecord } from '../../../utils/governance/onboarding/Onboarding.utils';
import { canEditOnboardingTag } from '../../../utils/governance/onboarding/OnboardingJourney.utils';
import RichTextEditor from '../../common/RichTextEditor/RichTextEditor';
import {
  OnboardingAssignees,
  OnboardingSearchIndex,
} from './OnboardingAssignees';

interface Props {
  path: string;
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
  permissions?: OperationPermission;
}
const ENUM_OPTIONS: Record<string, string[]> = {
  metricType: Object.values(MetricType),
  granularity: Object.values(MetricGranularity),
  unitOfMeasurement: Object.values(UnitOfMeasurement),
  dataProductType: Object.values(DataProductType),
  visibility: Object.values(Visibility),
  portfolioPriority: Object.values(PortfolioPriority),
  domainType: Object.values(DomainType),
};
const REFERENCES: Record<string, OnboardingSearchIndex[]> = {
  glossary: [SearchIndex.GLOSSARY],
  owners: [SearchIndex.USER, SearchIndex.TEAM],
  reviewers: [SearchIndex.USER, SearchIndex.TEAM],
  experts: [SearchIndex.USER],
  domains: [SearchIndex.DOMAIN],
  relatedMetrics: [SearchIndex.METRIC],
  relatedTerms: [SearchIndex.GLOSSARY_TERM],
};
const TAG_INDICES: OnboardingSearchIndex[] = [
  SearchIndex.TAG,
  SearchIndex.GLOSSARY_TERM,
];
const isReference = (value: unknown): value is EntityReference =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.type === 'string';

const textValue = (value: unknown) => (typeof value === 'string' ? value : '');
const referenceValues = (value: unknown) =>
  Array.isArray(value) ? value.filter(isReference) : [];
const relationValues = (value: unknown) =>
  Array.isArray(value) ? value.filter(isRecord) : [];
const selectedReferences = (path: string, value: unknown) => {
  if (path === 'glossary') {
    return isReference(value) ? [value] : [];
  }
  if (path === 'relatedTerms') {
    return relationValues(value)
      .map((relation) => relation.term)
      .filter(isReference);
  }

  return referenceValues(value);
};
const serializeReferences = (
  path: string,
  value: unknown,
  selected: EntityReference[]
) => {
  if (path === 'glossary') {
    return selected.at(-1);
  }
  if (path === 'relatedTerms') {
    return selected.map(
      (term) =>
        relationValues(value).find(
          (relation) =>
            isReference(relation.term) && relation.term.id === term.id
        ) ?? { term, relationType: 'relatedTo' }
    );
  }

  return selected;
};
const tagReferences = (value: unknown): EntityReference[] =>
  (Array.isArray(value) ? value : []).filter(isRecord).map((tag) => ({
    id: String(tag.tagFQN),
    name: String(tag.tagFQN),
    fullyQualifiedName: String(tag.tagFQN),
    type: tag.source === TagSource.Glossary ? 'glossaryTerm' : 'tag',
  }));

const inputValue = (value: unknown) =>
  typeof value === 'number' ? String(value) : textValue(value);

export const OnboardingNativeInput = ({
  path,
  label,
  value,
  onChange,
  permissions,
}: Props) => {
  const { t } = useTranslation();
  const selectableTag = useCallback(
    (tag: EntityReference) => canEditOnboardingTag(permissions, tag),
    [permissions]
  );
  if (REFERENCES[path]) {
    return (
      <OnboardingAssignees
        label={label}
        searchIndex={REFERENCES[path]}
        value={selectedReferences(path, value)}
        onChange={(selected) =>
          onChange(serializeReferences(path, value, selected))
        }
      />
    );
  }
  if (path === 'tags') {
    const tags = tagReferences(value);
    const protectedTags = tags.filter((tag) => !selectableTag(tag));

    return (
      <Box direction="col" gap={2}>
        <OnboardingAssignees
          isSelectable={selectableTag}
          label={label}
          searchIndex={TAG_INDICES}
          value={tags.filter(selectableTag)}
          onChange={(selected) =>
            onChange(
              [...protectedTags, ...selected].map(
                (tag) =>
                  (Array.isArray(value) ? value : []).find(
                    (original) =>
                      isRecord(original) &&
                      original.tagFQN === tag.fullyQualifiedName
                  ) ?? {
                    tagFQN: tag.fullyQualifiedName ?? tag.name,
                    source:
                      tag.type === 'glossaryTerm'
                        ? TagSource.Glossary
                        : TagSource.Classification,
                    labelType: LabelType.Manual,
                    state: State.Confirmed,
                  }
              )
            )
          }
        />
        {protectedTags.length > 0 && (
          <Typography className="tw:text-tertiary" size="text-sm">
            {protectedTags.map((tag) => tag.fullyQualifiedName).join(', ')}
          </Typography>
        )}
      </Box>
    );
  }
  if (ENUM_OPTIONS[path]) {
    return (
      <Select
        label={label}
        selectedKey={typeof value === 'string' ? value : null}
        onSelectionChange={onChange}>
        {ENUM_OPTIONS[path].map((option) => (
          <Select.Item id={option} key={option} label={option} />
        ))}
      </Select>
    );
  }
  if (path === 'description') {
    return (
      <RichTextEditor initialValue={textValue(value)} onTextChange={onChange} />
    );
  }
  if (path === 'synonyms') {
    return (
      <Input
        hint={t('message.onboarding-comma-separated')}
        label={label}
        value={Array.isArray(value) ? value.join(', ') : textValue(value)}
        onChange={onChange}
      />
    );
  }
  if (path.endsWith('.code')) {
    return (
      <TextArea label={label} value={textValue(value)} onChange={onChange} />
    );
  }

  return <Input label={label} value={inputValue(value)} onChange={onChange} />;
};
