/*
 *  Copyright 2023 Collate.
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
  ArrowUpRight,
  Bold01,
  BookOpen02,
  Check,
  ChevronDown,
  Code01,
  Cube01,
  Globe02,
  Italic01,
  List,
  Plus,
  SearchLg,
  Sliders02,
  Tag01,
  Type01,
} from '@untitledui/icons';
import Select, { DefaultOptionType } from 'antd/lib/select';
import { isEmpty, startCase, toString } from 'lodash';
import {
  CSSProperties,
  FocusEvent,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { RenderEditCellProps } from 'react-data-grid';
import { createPortal } from 'react-dom';
import Certification from '../../components/Certification/Certification.component';
import TreeAsyncSelectList from '../../components/common/AsyncSelectList/TreeAsyncSelectList';
import { lazyTextEditor } from '../../components/common/DataGrid/LazyDataGrid';
import DomainSelectableList from '../../components/common/DomainSelectableList/DomainSelectableList.component';
import CsvCellPreview from '../../components/common/EntityImport/CsvCellPreview/CsvCellPreview.component';
import ExpressionCodeCell from '../../components/common/EntityImport/ExpressionCodeCell/ExpressionCodeCell.component';
import { useMultiContainerFocusTrap } from '../../components/common/FocusTrap/FocusTrapWithContainer';
import InlineEdit from '../../components/common/InlineEdit/InlineEdit.component';
import { KeyDownStopPropagationWrapper } from '../../components/common/KeyDownStopPropagationWrapper/KeyDownStopPropagationWrapper';
import TierCard from '../../components/common/TierCard/TierCard';
import { UserTeamSelectableList } from '../../components/common/UserTeamSelectableList/UserTeamSelectableList.component';
import { ValueRendererOnEditCell } from '../../components/common/ValueRendererOnEditCell/ValueRendererOnEditCell';
import DataAssetAsyncSelectList from '../../components/DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList';
import { DataAssetOption } from '../../components/DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList.interface';
import { ModalWithCustomPropertyEditor } from '../../components/Modals/ModalWithCustomProperty/ModalWithCustomPropertyEditor.component';
import {
  ExtensionDataProps,
  ExtensionDataTypes,
} from '../../components/Modals/ModalWithCustomProperty/ModalWithMarkdownEditor.interface';
import { ModalWithMarkdownEditor } from '../../components/Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import SchemaModal from '../../components/Modals/SchemaModal/SchemaModal';
import { ENTITY_TYPE_OPTIONS } from '../../constants/BulkImport.constant';
import {
  PAGE_SIZE_MEDIUM,
  PLACEHOLDER_ROUTE_ENTITY_TYPE,
  ROUTES,
} from '../../constants/constants';
import { CSMode } from '../../enums/codemirror.enum';
import { EntityType } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { Tag } from '../../generated/entity/classification/tag';
import { Language } from '../../generated/entity/data/metric';
import { Config, EntityReference, Type } from '../../generated/entity/type';
import { TagLabel, TagSource } from '../../generated/type/tagLabel';
import TagSuggestion from '../../pages/TasksPage/shared/TagSuggestion';
import { fetchDataProductsElasticSearch } from '../../rest/dataProductAPI';
import { getDomainList } from '../../rest/domainAPI';
import { getGlossariesList, getGlossaryTerms } from '../../rest/glossaryAPI';
import { getTypeByFQN } from '../../rest/metadataTypeAPI';
import { getMetrics } from '../../rest/metricsAPI';
import { searchQuery } from '../../rest/searchAPI';
import { getAllClassifications, getTags } from '../../rest/tagAPI';
import { formatTeamsResponse, formatUsersResponse } from '../APIUtils';
import { getEntityName } from '../EntityUtils';
import Fqn from '../Fqn';
import { t } from '../i18next/LocalUtil';
import { getTermQuery } from '../SearchUtils';
import { removeOuterEscapes } from '../StringUtils';
import {
  convertCustomPropertyStringToEntityExtension,
  convertEntityExtensionToCustomPropertyString,
  getCustomPropertyEntityType,
  isSystemClassificationTagFqn,
} from './CSV.utils';
import entityBulkEditConfigClassBase from './EntityBulkEditConfigClassBase';

export interface CSVEditorOptions {
  usePlainTextEditor?: boolean;
}

type CustomPropertyDefinition = NonNullable<Type['customProperties']>[number];

interface InlineDescriptionEditorProps {
  value: string;
  onCancel: () => void;
  onComplete: (value: string) => void;
}

interface InlineTextCellEditorProps {
  value: string;
  onCancel: () => void;
  onComplete: (value: string) => void;
}

const InlineTextCellEditor = ({
  value,
  onCancel,
  onComplete,
}: InlineTextCellEditorProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cancelledRef = useRef(false);
  const completedRef = useRef(false);
  const draftRef = useRef(value);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    const input = inputRef.current;

    if (!input) {
      return;
    }

    input.focus();
    input.setSelectionRange(value.length, value.length);
  }, [value]);

  useEffect(
    () => () => {
      if (
        !cancelledRef.current &&
        !completedRef.current &&
        draftRef.current !== value
      ) {
        const pendingDraft = draftRef.current;
        completedRef.current = true;
        queueMicrotask(() => onComplete(pendingDraft));
      }
    },
    [onComplete, value]
  );

  const handleComplete = (nextValue: string) => {
    completedRef.current = true;
    onComplete(nextValue);
  };

  const handleBlur = () => {
    if (cancelledRef.current) {
      return;
    }

    handleComplete(draftRef.current);
  };

  const handleChange = (nextValue: string) => {
    draftRef.current = nextValue;
    setDraft(nextValue);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelledRef.current = true;
      onCancel();

      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      handleComplete(draftRef.current);
    }
  };

  return (
    <KeyDownStopPropagationWrapper keys={['Enter', 'Escape', 'Tab']}>
      <input
        className="bulk-edit-text-cell-editor"
        data-testid="bulk-edit-text-cell-editor"
        ref={inputRef}
        value={draft}
        onBlur={handleBlur}
        onChange={(event) => handleChange(event.target.value)}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
      />
    </KeyDownStopPropagationWrapper>
  );
};

const getInlineTextCellEditor =
  () =>
  ({
    row,
    onRowChange,
    onClose,
    column,
  }: RenderEditCellProps<Record<string, unknown>, unknown>) => {
    const value = String(row[column.key] ?? '');
    const handleComplete = (nextValue: string) => {
      if (nextValue === value) {
        onClose(false);

        return;
      }

      onRowChange({ ...row, [column.key]: nextValue }, true);
      onClose(true);
    };

    return (
      <InlineTextCellEditor
        value={value}
        onCancel={() => onClose(false)}
        onComplete={handleComplete}
      />
    );
  };

const CUSTOM_PROPERTY_TYPE_REQUESTS = new Map<string, Promise<Type>>();

const getCustomPropertyType = (entityType: EntityType) => {
  const customPropertyEntityType = getCustomPropertyEntityType(entityType);
  const activeRequest = CUSTOM_PROPERTY_TYPE_REQUESTS.get(
    customPropertyEntityType
  );

  if (activeRequest) {
    return activeRequest;
  }

  const typePromise = getTypeByFQN(customPropertyEntityType).finally(() => {
    CUSTOM_PROPERTY_TYPE_REQUESTS.delete(customPropertyEntityType);
  });
  CUSTOM_PROPERTY_TYPE_REQUESTS.set(customPropertyEntityType, typePromise);

  return typePromise;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getCustomPropertyConfigValues = (config?: string[] | Config | string) => {
  if (Array.isArray(config)) {
    return config;
  }

  if (isRecord(config) && Array.isArray(config.values)) {
    return config.values.map(String);
  }

  if (typeof config === 'string' && config.trim()) {
    return config.split(',').map((value) => value.trim());
  }

  return [];
};

const isCustomPropertyValueSet = (value: ExtensionDataTypes | undefined) => {
  if (value === undefined || value === null || value === '') {
    return false;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (isRecord(value)) {
    return Object.values(value).some((item) => {
      if (Array.isArray(item)) {
        return item.length > 0;
      }

      return item !== undefined && item !== null && item !== '';
    });
  }

  return true;
};

const getCleanCustomPropertyDraft = (draft: ExtensionDataProps) =>
  Object.entries(draft).reduce<ExtensionDataProps>((acc, [key, value]) => {
    if (isCustomPropertyValueSet(value)) {
      acc[key] = value;
    }

    return acc;
  }, {});

const getCustomPropertyValueAsString = (
  value: ExtensionDataTypes | undefined
): string => {
  if (value === undefined || value === null) {
    return '';
  }

  if (Array.isArray(value)) {
    return value.map(getCustomPropertyValueAsString).join(', ');
  }

  if (isRecord(value)) {
    if ('fullyQualifiedName' in value) {
      return String(value.fullyQualifiedName ?? '');
    }

    return JSON.stringify(value);
  }

  return String(value);
};

const getCustomPropertyEnumValues = (value: ExtensionDataTypes | undefined) => {
  if (Array.isArray(value)) {
    return value.map(String);
  }

  if (value === undefined || value === null || value === '') {
    return [];
  }

  return [String(value)];
};

const isCustomPropertyEnumMultiSelect = (
  customProperty: CustomPropertyDefinition
) => {
  const config = customProperty.customPropertyConfig?.config;

  return isRecord(config) && Boolean(config.multiSelect);
};

const isEntityReferenceValue = (
  value: ExtensionDataTypes | undefined
): value is EntityReference =>
  isRecord(value) &&
  typeof value.type === 'string' &&
  Boolean(value.fullyQualifiedName ?? value.name ?? value.id);

const getEntityReferenceOptionValue = (reference: EntityReference) =>
  reference.fullyQualifiedName ?? reference.name ?? reference.id;

const getEntityReferenceOption = (
  reference: EntityReference
): DataAssetOption => {
  const label = getEntityName(reference);

  return {
    displayName: label,
    label,
    name: reference.name,
    reference,
    value: getEntityReferenceOptionValue(reference),
  };
};

const getEntityReferenceInitialOptions = (
  value: ExtensionDataTypes | undefined
) => {
  const references = Array.isArray(value)
    ? value.filter(isEntityReferenceValue)
    : isEntityReferenceValue(value)
    ? [value]
    : [];

  return references.map(getEntityReferenceOption);
};

const getEntityReferenceSelectValue = (
  value: ExtensionDataTypes | undefined
) => {
  if (Array.isArray(value)) {
    return value
      .filter(isEntityReferenceValue)
      .map(getEntityReferenceOptionValue);
  }

  if (isEntityReferenceValue(value)) {
    return getEntityReferenceOptionValue(value);
  }

  return undefined;
};

const getCustomPropertyReferenceSearchIndex = (
  customProperty: CustomPropertyDefinition
) => {
  const config = customProperty.customPropertyConfig?.config;

  if (Array.isArray(config) && config.length) {
    return config.join(',') as SearchIndex;
  }

  if (typeof config === 'string' && config.trim()) {
    return config as SearchIndex;
  }

  return SearchIndex.ALL;
};

const BULK_EDIT_PICKER_WIDTH = 340;

const getBulkEditFloatingEditorPosition = (
  trigger: HTMLElement,
  width = BULK_EDIT_PICKER_WIDTH
): CSSProperties => {
  const rect = trigger.getBoundingClientRect();
  const viewportGap = 8;
  const triggerGap = 4;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const editorWidth = Math.min(width, viewportWidth - viewportGap * 2);
  const spaceBelow = viewportHeight - rect.bottom;
  const spaceAbove = rect.top;
  const openUp = spaceBelow < 240 && spaceAbove > spaceBelow;
  const maxHeight = Math.max(
    160,
    Math.min(340, (openUp ? spaceAbove : spaceBelow) - viewportGap - triggerGap)
  );
  const left = Math.max(
    viewportGap,
    Math.min(rect.left, viewportWidth - editorWidth - viewportGap)
  );

  return {
    bottom: openUp ? viewportHeight - rect.top + triggerGap : 'auto',
    left,
    maxHeight,
    position: 'fixed',
    top: openUp ? 'auto' : rect.bottom + triggerGap,
    width: editorWidth,
  };
};

interface InlineCustomPropertiesEditorProps {
  entityType: EntityType;
  value: string;
  onCancel: () => void;
  onComplete: (value: string) => void;
}

type BulkEditPickerColumn =
  | 'domains'
  | 'dataProducts'
  | 'tags'
  | 'glossaryTerms'
  | 'owners'
  | 'owner'
  | 'reviewers'
  | 'relatedMetrics';

type BulkEditPickerOptionType =
  | 'domain'
  | 'dataProduct'
  | 'tag'
  | 'glossary'
  | 'user'
  | 'team'
  | 'metric';

interface BulkEditPickerOption {
  avatarLabel?: string;
  avatarStyle?: CSSProperties;
  color?: string;
  description?: string;
  kind: BulkEditPickerOptionType;
  label: string;
  value: string;
}

interface BulkEditPickerOptionInput {
  avatarLabel?: string;
  avatarStyle?: CSSProperties;
  color?: string;
  description?: string;
  displayName?: string;
  fullyQualifiedName?: string;
  kind: BulkEditPickerOptionType;
  name?: string;
  value?: string;
}

interface BulkEditPickerConfig {
  actionPath: string;
  actionStyle: 'primary' | 'secondary';
  description: string;
  emptyIcon: ReactNode;
  emptyTitle: string;
  hint?: string;
  placeholder: string;
  primaryActionLabel: string;
  searchPlaceholder: string;
  secondaryActionLabel?: string;
  secondaryActionPath?: string;
  title: string;
}

interface InlineBulkEditReferencePickerEditorProps {
  columnKey: BulkEditPickerColumn;
  includeTeams?: boolean;
  value: string;
  onCancel: () => void;
  onComplete: (value: string) => void;
}

const getBulkEditPickerValues = (value: string) =>
  value
    ? value
        .split(';')
        .map((item) => removeOuterEscapes(item.trim()))
        .filter(Boolean)
    : [];

const BULK_EDIT_AVATAR_STYLES = [
  { backgroundColor: '#fee4e2', color: '#b42318' },
  { backgroundColor: '#dcfae6', color: '#067647' },
  { backgroundColor: '#eef4ff', color: '#3538cd' },
  { backgroundColor: '#fef6ee', color: '#b93815' },
  { backgroundColor: '#f4f3ff', color: '#5925dc' },
  { backgroundColor: '#e0f2fe', color: '#026aa2' },
];

const getBulkEditAvatarInitials = (label: string) => {
  const parts = label.replace(/[_-]/g, ' ').split(/\s+/).filter(Boolean);

  if (parts.length > 1) {
    return parts
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  return label.slice(0, 2).toUpperCase();
};

const getBulkEditAvatarStyle = (seed: string): CSSProperties => {
  const index = Array.from(seed).reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0
  );

  return BULK_EDIT_AVATAR_STYLES[index % BULK_EDIT_AVATAR_STYLES.length];
};

const getBulkEditPickerOption = ({
  avatarLabel,
  avatarStyle,
  color,
  description,
  displayName,
  fullyQualifiedName,
  kind,
  name,
  value,
}: BulkEditPickerOptionInput): BulkEditPickerOption | undefined => {
  const optionValue = value ?? fullyQualifiedName ?? name;

  if (!optionValue) {
    return undefined;
  }

  const label = displayName ?? name ?? optionValue;

  return {
    avatarLabel,
    avatarStyle,
    color,
    description,
    kind,
    label,
    value: optionValue,
  };
};

const getBulkEditOptionContext = (entity: string, context?: string) =>
  context
    ? t('message.bulk-edit-picker-option-context', { context, entity })
    : entity;

const getBulkEditTagFqn = (tag: Tag) =>
  tag.fullyQualifiedName ??
  [tag.classification?.name, tag.name].filter(Boolean).join('.');

const getBulkEditGlossaryTermHierarchyLabel = (
  glossaryTerm: Awaited<ReturnType<typeof getGlossaryTerms>>['data'][number]
) => {
  const fallback =
    glossaryTerm.displayName ??
    glossaryTerm.name ??
    glossaryTerm.fullyQualifiedName;

  if (!glossaryTerm.fullyQualifiedName) {
    return fallback;
  }

  try {
    const hierarchy = Fqn.split(glossaryTerm.fullyQualifiedName).filter(
      Boolean
    );

    return hierarchy.length > 1 ? hierarchy.join(' / ') : fallback;
  } catch {
    return fallback;
  }
};

const getFirstEntityName = (
  refs?: Array<{ displayName?: string; name?: string }>
) => refs?.map(getEntityName).filter(Boolean)[0];

const getBulkEditUserDescription = (
  user: ReturnType<typeof formatUsersResponse>[number]
) => {
  const role = getFirstEntityName(user.roles);
  const team = getFirstEntityName(user.teams);

  if (role && team) {
    return getBulkEditOptionContext(role, team);
  }

  return role ?? team ?? user.email;
};

const loadBulkEditUserOptions = async (
  searchText: string,
  includeTeams: boolean
) => {
  const usersPromise = searchQuery({
    pageNumber: 1,
    pageSize: PAGE_SIZE_MEDIUM,
    query: searchText,
    queryFilter: getTermQuery({ isBot: 'false' }),
    searchIndex: SearchIndex.USER,
    sortField: 'displayName.keyword',
    sortOrder: 'asc',
  });
  const teamsPromise = includeTeams
    ? searchQuery({
        pageNumber: 1,
        pageSize: PAGE_SIZE_MEDIUM,
        query: searchText,
        queryFilter: getTermQuery({}, 'must', undefined, {
          matchTerms: { teamType: 'Group' },
        }),
        searchIndex: SearchIndex.TEAM,
        sortField: 'displayName.keyword',
        sortOrder: 'asc',
      })
    : Promise.resolve(undefined);

  const [usersResponse, teamsResponse] = await Promise.all([
    usersPromise,
    teamsPromise,
  ]);

  const users = formatUsersResponse(usersResponse.hits.hits)
    .map((user) => {
      const label = getEntityName(user);

      return getBulkEditPickerOption({
        avatarLabel: getBulkEditAvatarInitials(label),
        avatarStyle: getBulkEditAvatarStyle(label),
        description: getBulkEditUserDescription(user),
        displayName: user.displayName,
        kind: 'user',
        name: user.name,
        value: `${EntityType.USER}:${user.name}`,
      });
    })
    .filter((option): option is BulkEditPickerOption => Boolean(option));
  const teams =
    teamsResponse === undefined
      ? []
      : formatTeamsResponse(teamsResponse.hits.hits)
          .map((team) => {
            const label = getEntityName(team);

            return getBulkEditPickerOption({
              avatarLabel: getBulkEditAvatarInitials(label),
              avatarStyle: getBulkEditAvatarStyle(label),
              description: t('label.team'),
              displayName: team.displayName,
              kind: 'team',
              name: team.name,
              value: `${EntityType.TEAM}:${team.name}`,
            });
          })
          .filter((option): option is BulkEditPickerOption => Boolean(option));

  return [...users, ...teams];
};

const getFilteredBulkEditPickerOptions = (
  options: BulkEditPickerOption[],
  searchText: string
) => {
  if (!searchText.trim()) {
    return options;
  }

  const normalizedSearchText = searchText.trim().toLowerCase();

  return options.filter(
    (option) =>
      option.label.toLowerCase().includes(normalizedSearchText) ||
      option.value.toLowerCase().includes(normalizedSearchText) ||
      Boolean(option.description?.toLowerCase().includes(normalizedSearchText))
  );
};

const loadBulkEditPickerOptions = async (
  columnKey: BulkEditPickerColumn,
  searchText: string,
  includeTeams = false
) => {
  switch (columnKey) {
    case 'owner':
    case 'owners':
    case 'reviewers':
      return loadBulkEditUserOptions(searchText, includeTeams);

    case 'domains': {
      const response = await getDomainList({ limit: 50 });

      return getFilteredBulkEditPickerOptions(
        response.data
          .map((domain) =>
            getBulkEditPickerOption({
              color: domain.style?.color,
              description: getBulkEditOptionContext(t('label.domain')),
              displayName: domain.displayName,
              fullyQualifiedName: domain.fullyQualifiedName,
              kind: 'domain',
              name: domain.name,
            })
          )
          .filter((option): option is BulkEditPickerOption => Boolean(option)),
        searchText
      );
    }

    case 'dataProducts': {
      const response = await fetchDataProductsElasticSearch(searchText, [], 1);

      return response.data
        .map(({ value }) =>
          getBulkEditPickerOption({
            color: value.style?.color,
            description: getBulkEditOptionContext(t('label.data-product')),
            displayName: value.displayName,
            fullyQualifiedName: value.fullyQualifiedName,
            kind: 'dataProduct',
            name: value.name,
          })
        )
        .filter((option): option is BulkEditPickerOption => Boolean(option));
    }

    case 'tags': {
      const [classifications, tags] = await Promise.all([
        getAllClassifications({ limit: 1 }),
        getTags({ disabled: false, limit: 50 }),
      ]);

      if (!classifications.data.length && !tags.data.length) {
        return [];
      }

      return getFilteredBulkEditPickerOptions(
        tags.data
          .filter(
            (tag) => !isSystemClassificationTagFqn(getBulkEditTagFqn(tag))
          )
          .map((tag) =>
            getBulkEditPickerOption({
              color: tag.style?.color,
              description: tag.description,
              displayName: tag.displayName,
              fullyQualifiedName: tag.fullyQualifiedName,
              kind: 'tag',
              name: tag.name,
            })
          )
          .filter((option): option is BulkEditPickerOption => Boolean(option)),
        searchText
      );
    }

    case 'glossaryTerms': {
      const [glossaries, glossaryTerms] = await Promise.all([
        getGlossariesList({ limit: 1 }),
        getGlossaryTerms({ limit: 50 }),
      ]);

      if (!glossaries.data.length && !glossaryTerms.data.length) {
        return [];
      }

      return getFilteredBulkEditPickerOptions(
        glossaryTerms.data
          .map((glossaryTerm) =>
            getBulkEditPickerOption({
              color: glossaryTerm.style?.color,
              description: getBulkEditOptionContext(
                t('label.glossary'),
                getEntityName(glossaryTerm.glossary)
              ),
              displayName: getBulkEditGlossaryTermHierarchyLabel(glossaryTerm),
              fullyQualifiedName: glossaryTerm.fullyQualifiedName,
              kind: 'glossary',
              name: glossaryTerm.name,
            })
          )
          .filter((option): option is BulkEditPickerOption => Boolean(option)),
        searchText
      );
    }

    case 'relatedMetrics': {
      const response = await getMetrics({ fields: 'domains', limit: 50 });

      return getFilteredBulkEditPickerOptions(
        response.data
          .map((metric) =>
            getBulkEditPickerOption({
              description: getBulkEditOptionContext(
                t('label.metric'),
                metric.domains?.map(getEntityName).filter(Boolean).join(', ')
              ),
              displayName: metric.displayName,
              fullyQualifiedName: metric.fullyQualifiedName,
              kind: 'metric',
              name: metric.name,
            })
          )
          .filter((option): option is BulkEditPickerOption => Boolean(option)),
        searchText
      );
    }
  }
};

const serializeBulkEditPickerValues = (
  columnKey: BulkEditPickerColumn,
  values: string[]
) => {
  if (columnKey === 'domains') {
    return values.map((value) => `"${value.replace(/"/g, '""')}"`).join(';');
  }

  return values.join(';');
};

const getBulkEditPickerConfig = (
  columnKey: BulkEditPickerColumn
): BulkEditPickerConfig => {
  switch (columnKey) {
    case 'owner':
    case 'owners':
      return {
        actionPath: ROUTES.USER_LIST,
        actionStyle: 'secondary',
        description: t('message.bulk-edit-owners-empty-description'),
        emptyIcon: <Sliders02 size={20} />,
        emptyTitle: t('message.bulk-edit-no-owners-available'),
        placeholder: t('message.bulk-edit-owners-placeholder'),
        primaryActionLabel: t('message.bulk-edit-open-users-and-teams'),
        searchPlaceholder: t('message.bulk-edit-owners-search-placeholder'),
        title: t('label.owner-plural'),
      };

    case 'reviewers':
      return {
        actionPath: ROUTES.USER_LIST,
        actionStyle: 'secondary',
        description: t('message.bulk-edit-reviewers-empty-description'),
        emptyIcon: <Sliders02 size={20} />,
        emptyTitle: t('message.bulk-edit-no-reviewers-available'),
        placeholder: t('message.bulk-edit-reviewers-placeholder'),
        primaryActionLabel: t('message.bulk-edit-open-users'),
        searchPlaceholder: t('message.bulk-edit-reviewers-search-placeholder'),
        title: t('label.reviewer-plural'),
      };

    case 'domains':
      return {
        actionPath: ROUTES.DOMAIN,
        actionStyle: 'secondary',
        description: t('message.bulk-edit-domains-empty-description'),
        emptyIcon: <Globe02 size={20} />,
        emptyTitle: t('message.bulk-edit-no-domains-available'),
        hint: t('message.bulk-edit-domains-empty-hint'),
        placeholder: t('message.bulk-edit-domains-placeholder'),
        primaryActionLabel: t('message.bulk-edit-open-domains-settings'),
        searchPlaceholder: t('message.bulk-edit-domains-search-placeholder'),
        title: t('label.domain-plural'),
      };

    case 'dataProducts':
      return {
        actionPath: ROUTES.DATA_PRODUCT,
        actionStyle: 'secondary',
        description: t('message.bulk-edit-data-products-empty-description'),
        emptyIcon: <Cube01 size={20} />,
        emptyTitle: t('message.bulk-edit-no-data-products-available'),
        hint: t('message.bulk-edit-data-products-empty-hint'),
        placeholder: t('message.bulk-edit-data-products-placeholder'),
        primaryActionLabel: t('message.bulk-edit-open-data-products'),
        searchPlaceholder: t(
          'message.bulk-edit-data-products-search-placeholder'
        ),
        title: t('label.data-product-plural'),
      };

    case 'tags':
      return {
        actionPath: ROUTES.TAGS,
        actionStyle: 'primary',
        description: t('message.bulk-edit-tags-empty-description'),
        emptyIcon: <Tag01 size={20} />,
        emptyTitle: t('message.bulk-edit-no-tags-yet'),
        placeholder: t('message.bulk-edit-tags-placeholder'),
        primaryActionLabel: t('message.bulk-edit-create-a-tag'),
        searchPlaceholder: t('message.bulk-edit-tags-search-placeholder'),
        secondaryActionLabel: t('message.bulk-edit-manage-classifications'),
        secondaryActionPath: ROUTES.TAGS,
        title: t('label.tag-plural'),
      };

    case 'glossaryTerms':
      return {
        actionPath: ROUTES.GLOSSARY,
        actionStyle: 'primary',
        description: t('message.bulk-edit-glossary-terms-empty-description'),
        emptyIcon: <BookOpen02 size={20} />,
        emptyTitle: t('message.bulk-edit-no-glossary-terms-yet'),
        placeholder: t('message.bulk-edit-glossary-terms-placeholder'),
        primaryActionLabel: t('message.bulk-edit-create-glossary-term'),
        searchPlaceholder: t(
          'message.bulk-edit-glossary-terms-search-placeholder'
        ),
        secondaryActionLabel: t('message.bulk-edit-open-glossary'),
        secondaryActionPath: ROUTES.GLOSSARY,
        title: t('label.glossary-term-plural'),
      };

    case 'relatedMetrics':
      return {
        actionPath: ROUTES.METRICS,
        actionStyle: 'secondary',
        description: t('message.bulk-edit-related-metrics-empty-description'),
        emptyIcon: <Sliders02 size={20} />,
        emptyTitle: t('message.bulk-edit-no-related-metrics-available'),
        placeholder: t('message.bulk-edit-related-metrics-placeholder'),
        primaryActionLabel: t('message.bulk-edit-open-metrics'),
        searchPlaceholder: t(
          'message.bulk-edit-related-metrics-search-placeholder'
        ),
        title: t('label.related-metric-plural'),
      };
  }
};

const openBulkEditPickerPath = (path: string) => {
  window.open(path, '_blank', 'noopener,noreferrer');
};

const renderBulkEditPickerOptionMarker = (option: BulkEditPickerOption) => {
  if (option.avatarLabel) {
    return (
      <span
        className={`bulk-edit-picker-option-avatar ${option.kind}`}
        style={option.avatarStyle}>
        {option.avatarLabel}
      </span>
    );
  }

  return (
    <span
      className={`bulk-edit-picker-option-swatch ${option.kind}`}
      style={option.color ? { backgroundColor: option.color } : undefined}
    />
  );
};

const InlineBulkEditReferencePickerEditor = ({
  columnKey,
  includeTeams = false,
  value,
  onCancel,
  onComplete,
}: InlineBulkEditReferencePickerEditorProps) => {
  const config = getBulkEditPickerConfig(columnKey);
  const [searchText, setSearchText] = useState('');
  const [options, setOptions] = useState<BulkEditPickerOption[]>([]);
  const [draft, setDraft] = useState(() => getBulkEditPickerValues(value));
  const [isLoading, setIsLoading] = useState(true);
  const triggerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const [editorPosition, setEditorPosition] = useState<CSSProperties>({
    left: 0,
    position: 'fixed',
    top: 0,
    visibility: 'hidden',
    width: BULK_EDIT_PICKER_WIDTH,
  });

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    loadBulkEditPickerOptions(columnKey, searchText, includeTeams)
      .then((nextOptions) => {
        if (isMounted) {
          setOptions(nextOptions);
        }
      })
      .catch(() => {
        if (isMounted) {
          setOptions([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [columnKey, includeTeams, searchText]);

  useEffect(() => {
    const updatePosition = () => {
      if (!triggerRef.current) {
        return;
      }

      setEditorPosition(getBulkEditFloatingEditorPosition(triggerRef.current));
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, []);

  useEffect(() => {
    const handleMouseDown = (event: globalThis.MouseEvent) => {
      const target = event.target as Node;

      if (
        triggerRef.current?.contains(target) ||
        editorRef.current?.contains(target)
      ) {
        return;
      }

      onCancel();
    };

    document.addEventListener('mousedown', handleMouseDown);

    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onCancel]);

  const selectedSet = useMemo(() => new Set(draft), [draft]);
  const hasOptions = options.length > 0;

  const handleToggleOption = (option: BulkEditPickerOption) => {
    setDraft((previous) =>
      previous.includes(option.value)
        ? previous.filter((item) => item !== option.value)
        : [...previous, option.value]
    );
  };

  const handleComplete = () =>
    onComplete(serializeBulkEditPickerValues(columnKey, draft));
  const handleClearAll = () => setDraft([]);

  const editor = (
    <KeyDownStopPropagationWrapper>
      <div
        className="bulk-edit-picker-editor"
        data-testid={`bulk-edit-${columnKey}-picker-editor`}
        ref={editorRef}
        style={editorPosition}
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}>
        <div className="bulk-edit-picker-body-card">
          <label className="bulk-edit-picker-search">
            <SearchLg size={14} />
            <input
              autoFocus
              placeholder={config.searchPlaceholder}
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
          </label>
          <div className="bulk-edit-picker-content">
            {isLoading ? (
              <span className="bulk-edit-picker-loading">
                {t('label.loading')}
              </span>
            ) : hasOptions ? (
              <div className="bulk-edit-picker-option-list">
                {options.map((option) => {
                  const isSelected = selectedSet.has(option.value);

                  return (
                    <button
                      className={`bulk-edit-picker-option${
                        isSelected ? ' selected' : ''
                      }`}
                      key={option.value}
                      type="button"
                      onClick={() => handleToggleOption(option)}>
                      {renderBulkEditPickerOptionMarker(option)}
                      <span className="bulk-edit-picker-option-meta">
                        <span className="bulk-edit-picker-option-label">
                          {option.label}
                        </span>
                        {option.description && (
                          <span className="bulk-edit-picker-option-value">
                            {option.description}
                          </span>
                        )}
                      </span>
                      {isSelected && <Check size={18} />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="bulk-edit-picker-empty-state">
                <div
                  className={`bulk-edit-picker-empty-icon ${config.actionStyle}`}>
                  {config.emptyIcon}
                </div>
                <div className="bulk-edit-picker-empty-title">
                  {config.emptyTitle}
                </div>
                <div className="bulk-edit-picker-empty-description">
                  {config.description}
                </div>
                <button
                  className={`bulk-edit-picker-empty-action ${config.actionStyle}`}
                  type="button"
                  onClick={() => openBulkEditPickerPath(config.actionPath)}>
                  {config.actionStyle === 'primary' ? (
                    <Plus size={14} />
                  ) : (
                    <ArrowUpRight size={14} />
                  )}
                  <span>{config.primaryActionLabel}</span>
                </button>
                {config.secondaryActionLabel && config.secondaryActionPath && (
                  <button
                    className="bulk-edit-picker-empty-secondary-action"
                    type="button"
                    onClick={() =>
                      openBulkEditPickerPath(config.secondaryActionPath ?? '')
                    }>
                    <span>{config.secondaryActionLabel}</span>
                    <ArrowUpRight size={14} />
                  </button>
                )}
                {config.hint && (
                  <span className="bulk-edit-picker-empty-hint">
                    {config.hint}
                  </span>
                )}
              </div>
            )}
          </div>
          {hasOptions && (
            <div className="bulk-edit-picker-footer">
              <button
                className="bulk-edit-picker-clear"
                disabled={!draft.length}
                type="button"
                onClick={handleClearAll}>
                {t('label.clear-all')}
              </button>
              <div className="bulk-edit-picker-actions">
                <button
                  className="bulk-edit-picker-cancel"
                  type="button"
                  onClick={onCancel}>
                  {t('label.cancel')}
                </button>
                <button
                  className="bulk-edit-picker-update"
                  type="button"
                  onClick={handleComplete}>
                  {t('label.update')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </KeyDownStopPropagationWrapper>
  );

  return (
    <>
      <div
        className="bulk-edit-custom-property-cell-trigger"
        data-testid={`bulk-edit-${columnKey}-cell-trigger`}
        ref={triggerRef}
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}>
        {value ? (
          <CsvCellPreview column={columnKey} value={value} />
        ) : (
          <span className="bulk-edit-custom-property-placeholder">
            {config.placeholder}
          </span>
        )}
      </div>
      {typeof document === 'undefined'
        ? editor
        : createPortal(editor, document.body)}
    </>
  );
};

const getInlineBulkEditReferencePickerEditor =
  (
    columnKey: BulkEditPickerColumn,
    pickerOptions: Pick<
      InlineBulkEditReferencePickerEditorProps,
      'includeTeams'
    > = {}
  ) =>
  ({
    row,
    onRowChange,
    onClose,
    column,
  }: RenderEditCellProps<Record<string, unknown>, unknown>) => {
    const value = String(row[column.key] ?? '');
    const handleComplete = (nextValue: string) => {
      if (nextValue === value) {
        onClose(false);

        return;
      }

      onRowChange({ ...row, [column.key]: nextValue }, true);
      onClose(true);
    };

    return (
      <InlineBulkEditReferencePickerEditor
        columnKey={columnKey}
        includeTeams={pickerOptions.includeTeams}
        value={value}
        onCancel={() => onClose(false)}
        onComplete={handleComplete}
      />
    );
  };

const InlineCustomPropertiesEditor = ({
  entityType,
  value,
  onCancel,
  onComplete,
}: InlineCustomPropertiesEditorProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [customPropertyType, setCustomPropertyType] = useState<Type>();
  const [draft, setDraft] = useState<ExtensionDataProps>({});
  const triggerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const [editorPosition, setEditorPosition] = useState<CSSProperties>({
    left: 0,
    position: 'fixed',
    top: 0,
    visibility: 'hidden',
    width: BULK_EDIT_PICKER_WIDTH,
  });

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    getCustomPropertyType(entityType)
      .then((type) => {
        if (!isMounted) {
          return;
        }

        setCustomPropertyType(type);
        setDraft(convertCustomPropertyStringToEntityExtension(value, type));
      })
      .catch(() => undefined)
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [entityType, value]);

  useEffect(() => {
    const updatePosition = () => {
      if (!triggerRef.current) {
        return;
      }

      setEditorPosition(getBulkEditFloatingEditorPosition(triggerRef.current));
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, []);

  useEffect(() => {
    const handleMouseDown = (event: globalThis.MouseEvent) => {
      const target = event.target as Node;

      if (
        triggerRef.current?.contains(target) ||
        editorRef.current?.contains(target)
      ) {
        return;
      }

      onCancel();
    };

    document.addEventListener('mousedown', handleMouseDown);

    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onCancel]);

  const customProperties = customPropertyType?.customProperties ?? [];
  const cleanDraft = useMemo(() => getCleanCustomPropertyDraft(draft), [draft]);
  const setCount = Object.keys(cleanDraft).length;
  const setLabel =
    t('label.is-set').toLowerCase().split(/\s+/).pop() ??
    t('label.is-set').toLowerCase();

  const handleUpdateDraft = (key: string, nextValue: ExtensionDataTypes) => {
    setDraft((prev) => ({
      ...prev,
      [key]: nextValue,
    }));
  };

  const handleClearAll = () => setDraft({});

  const handleOpenCustomPropertySettings = () => {
    window.open(
      ROUTES.ADD_CUSTOM_PROPERTY.replace(
        PLACEHOLDER_ROUTE_ENTITY_TYPE,
        entityType
      ),
      '_blank',
      'noopener,noreferrer'
    );
  };

  const handleComplete = () => {
    onComplete(
      convertEntityExtensionToCustomPropertyString(
        cleanDraft,
        customPropertyType
      ) ?? ''
    );
  };

  const renderField = (customProperty: CustomPropertyDefinition) => {
    const propertyType = customProperty.propertyType.name ?? '';
    const propertyValue = draft[customProperty.name];

    if (propertyType === 'enum') {
      const enumValues = getCustomPropertyConfigValues(
        customProperty.customPropertyConfig?.config
      );
      const selectedValues = getCustomPropertyEnumValues(propertyValue);
      const isMultiSelect = isCustomPropertyEnumMultiSelect(customProperty);
      const options = enumValues.map((option) => ({
        label: option,
        value: option,
      }));

      const handleEnumChange = (selectedValue?: string | string[]) => {
        handleUpdateDraft(
          customProperty.name,
          Array.isArray(selectedValue)
            ? selectedValue
            : selectedValue
            ? [selectedValue]
            : []
        );
      };

      return (
        <Select
          allowClear
          showSearch
          className="bulk-edit-custom-property-enum-select"
          getPopupContainer={() => document.body}
          mode={isMultiSelect ? 'multiple' : undefined}
          optionFilterProp="label"
          options={options}
          placeholder={t('label.enum-value-plural')}
          popupClassName="bulk-edit-custom-property-select-dropdown"
          value={isMultiSelect ? selectedValues : selectedValues[0]}
          onChange={handleEnumChange}
        />
      );
    }

    if (
      propertyType === 'entityReference' ||
      propertyType === 'entityReferenceList'
    ) {
      const isReferenceList = propertyType === 'entityReferenceList';
      const mode = isReferenceList ? 'multiple' : undefined;
      const initialOptions = getEntityReferenceInitialOptions(propertyValue);

      const handleReferenceChange = (
        option: DataAssetOption | DataAssetOption[]
      ) => {
        if (Array.isArray(option)) {
          handleUpdateDraft(
            customProperty.name,
            option.map((item) => item.reference)
          );

          return;
        }

        handleUpdateDraft(
          customProperty.name,
          option?.reference ?? (isReferenceList ? [] : '')
        );
      };

      return (
        <DataAssetAsyncSelectList
          className="bulk-edit-custom-property-reference-select"
          getPopupContainer={() => document.body}
          initialOptions={initialOptions}
          mode={mode}
          placeholder={
            isReferenceList
              ? t('label.entity-reference-plural')
              : t('label.entity-reference')
          }
          popupClassName="bulk-edit-custom-property-select-dropdown"
          searchIndex={getCustomPropertyReferenceSearchIndex(customProperty)}
          value={getEntityReferenceSelectValue(propertyValue)}
          onChange={handleReferenceChange}
        />
      );
    }

    if (propertyType === 'markdown' || propertyType === 'sqlQuery') {
      return (
        <textarea
          className="bulk-edit-custom-property-input"
          rows={2}
          value={getCustomPropertyValueAsString(propertyValue)}
          onChange={(event) =>
            handleUpdateDraft(customProperty.name, event.target.value)
          }
        />
      );
    }

    if (propertyType === 'timeInterval') {
      const interval = (
        isRecord(propertyValue) ? propertyValue : {}
      ) as Partial<{ start: number; end: number }>;

      return (
        <div className="bulk-edit-custom-property-time-interval">
          <input
            className="bulk-edit-custom-property-input"
            placeholder={t('label.start')}
            type="number"
            value={String(interval.start ?? '')}
            onChange={(event) =>
              handleUpdateDraft(customProperty.name, {
                ...interval,
                start: Number(event.target.value),
              } as { start: number; end: number })
            }
          />
          <input
            className="bulk-edit-custom-property-input"
            placeholder={t('label.end')}
            type="number"
            value={String(interval.end ?? '')}
            onChange={(event) =>
              handleUpdateDraft(customProperty.name, {
                ...interval,
                end: Number(event.target.value),
              } as { start: number; end: number })
            }
          />
        </div>
      );
    }

    return (
      <input
        className="bulk-edit-custom-property-input"
        type={['integer', 'number'].includes(propertyType) ? 'number' : 'text'}
        value={getCustomPropertyValueAsString(propertyValue)}
        onChange={(event) =>
          handleUpdateDraft(customProperty.name, event.target.value)
        }
      />
    );
  };

  const hasNoCustomPropertyDefinitions =
    !isLoading && customProperties.length === 0;
  const customPropertyEntityLabel =
    entityType === EntityType.METRIC
      ? t('label.metric-plural')
      : startCase(entityType);

  const editor = (
    <KeyDownStopPropagationWrapper>
      <div
        className={`bulk-edit-custom-property-editor${
          hasNoCustomPropertyDefinitions
            ? ' bulk-edit-custom-property-editor-empty'
            : ''
        }`}
        data-testid="bulk-edit-custom-property-editor"
        ref={editorRef}
        style={editorPosition}
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}>
        {hasNoCustomPropertyDefinitions ? (
          <div className="bulk-edit-custom-property-empty-card">
            <div className="bulk-edit-custom-property-empty-icon">
              <Sliders02 size={20} />
            </div>
            <div className="bulk-edit-custom-property-empty-title">
              {t('label.no-custom-properties-defined')}
            </div>
            <div className="bulk-edit-custom-property-empty-description">
              {t('message.custom-properties-defined-by-admins', {
                entity: customPropertyEntityLabel,
              })}
            </div>
            <button
              className="bulk-edit-custom-property-empty-action"
              type="button"
              onClick={handleOpenCustomPropertySettings}>
              <ArrowUpRight size={14} />
              <span>
                {t('label.add-a-entity', {
                  entity: t('label.custom-property').toLowerCase(),
                })}
              </span>
            </button>
            <span className="bulk-edit-custom-property-empty-hint">
              {t('label.admin-access-required')}
            </span>
          </div>
        ) : (
          <>
            <div className="bulk-edit-custom-property-editor-header">
              <span>{t('label.custom-property-plural')}</span>
              <span className="bulk-edit-custom-property-count">
                {`${setCount} ${t('label.of-lowercase')} ${
                  customProperties.length
                } ${setLabel}`}
              </span>
            </div>
            <div className="bulk-edit-custom-property-editor-body">
              {isLoading ? (
                <span className="csv-import-muted-text">
                  {t('label.loading')}
                </span>
              ) : (
                customProperties.map((customProperty) => {
                  const propertyLabel =
                    customProperty.displayName ??
                    startCase(customProperty.name);

                  return (
                    <div
                      className="bulk-edit-custom-property-field"
                      key={customProperty.name}>
                      <label className="bulk-edit-custom-property-label">
                        <span>{propertyLabel}</span>
                        <span className="bulk-edit-custom-property-type">
                          {customProperty.propertyType.name?.toUpperCase()}
                        </span>
                      </label>
                      {renderField(customProperty)}
                    </div>
                  );
                })
              )}
            </div>
            <div className="bulk-edit-custom-property-editor-footer">
              <button
                className="bulk-edit-custom-property-clear"
                disabled={setCount === 0}
                type="button"
                onClick={handleClearAll}>
                {t('label.clear-entity', {
                  entity: t('label.all-lowercase'),
                })}
              </button>
              <div className="bulk-edit-custom-property-actions">
                <button
                  className="bulk-edit-custom-property-cancel"
                  type="button"
                  onClick={onCancel}>
                  {t('label.cancel')}
                </button>
                <button
                  className="bulk-edit-custom-property-update"
                  type="button"
                  onClick={handleComplete}>
                  {t('label.update')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </KeyDownStopPropagationWrapper>
  );

  return (
    <>
      <div
        className="bulk-edit-custom-property-cell-trigger"
        data-testid="bulk-edit-custom-property-cell-trigger"
        ref={triggerRef}
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}>
        {value ? (
          <CsvCellPreview column="extension" value={value} />
        ) : (
          <span className="bulk-edit-custom-property-placeholder">
            {t('label.add-entity', {
              entity: t('label.custom-property-plural').toLowerCase(),
            })}
          </span>
        )}
      </div>
      {typeof document === 'undefined'
        ? editor
        : createPortal(editor, document.body)}
    </>
  );
};

const getInlineCustomPropertiesEditor =
  (entityType: EntityType) =>
  ({
    row,
    onRowChange,
    onClose,
    column,
  }: RenderEditCellProps<Record<string, unknown>, unknown>) => {
    const value = String(row[column.key] ?? '');
    const handleComplete = (nextValue: string) => {
      if (nextValue === value) {
        onClose(false);

        return;
      }

      onRowChange({ ...row, [column.key]: nextValue }, true);
      onClose(true);
    };

    return (
      <InlineCustomPropertiesEditor
        entityType={entityType}
        value={value}
        onCancel={() => onClose(false)}
        onComplete={handleComplete}
      />
    );
  };

const InlineDescriptionEditor = ({
  value,
  onCancel,
  onComplete,
}: InlineDescriptionEditorProps) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.focus();
    textarea.setSelectionRange(value.length, value.length);
  }, [value]);

  const restoreSelection = (
    nextValue: string,
    selectionStart: number,
    selectionEnd = selectionStart
  ) => {
    setDraft(nextValue);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(selectionStart, selectionEnd);
    });
  };

  const handleToolbarMouseDown = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  const applyInlineFormat = (prefix: string, suffix = prefix) => {
    const textarea = textareaRef.current;
    const selectionStart = textarea?.selectionStart ?? draft.length;
    const selectionEnd = textarea?.selectionEnd ?? draft.length;
    const selectedText = draft.slice(selectionStart, selectionEnd);
    const nextValue = `${draft.slice(
      0,
      selectionStart
    )}${prefix}${selectedText}${suffix}${draft.slice(selectionEnd)}`;
    const cursorStart = selectionStart + prefix.length;
    const cursorEnd = cursorStart + selectedText.length;

    restoreSelection(nextValue, cursorStart, cursorEnd);
  };

  const applyLineFormat = (formatter: (index: number) => string) => {
    const textarea = textareaRef.current;
    const selectionStart = textarea?.selectionStart ?? draft.length;
    const selectionEnd = textarea?.selectionEnd ?? draft.length;
    const lineStart = draft.lastIndexOf('\n', selectionStart - 1) + 1;
    const nextBreakIndex = draft.indexOf('\n', selectionEnd);
    const lineEnd = nextBreakIndex === -1 ? draft.length : nextBreakIndex;
    const selectedBlock = draft.slice(lineStart, lineEnd);
    const nextBlock = selectedBlock
      .split('\n')
      .map(
        (line, index) =>
          `${formatter(index)}${line.replace(/^(\s*([-*]|\d+\.)\s+)/, '')}`
      )
      .join('\n');
    const nextValue = `${draft.slice(0, lineStart)}${nextBlock}${draft.slice(
      lineEnd
    )}`;

    restoreSelection(
      nextValue,
      selectionStart,
      selectionStart + nextBlock.length
    );
  };

  const clearFormatting = () => {
    const nextValue = draft
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/_(.*?)_/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/^\s*[-*]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, '');

    restoreSelection(nextValue, nextValue.length);
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    const relatedTarget = event.relatedTarget;

    if (
      relatedTarget instanceof Node &&
      event.currentTarget.contains(relatedTarget)
    ) {
      return;
    }

    onComplete(draft);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();

      return;
    }

    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      onComplete(draft);
    }
  };

  return (
    <KeyDownStopPropagationWrapper keys={['Enter', 'Escape', 'Tab']}>
      <div
        className="bulk-edit-description-editor"
        data-testid="bulk-edit-description-editor"
        onBlur={handleBlur}>
        <div className="bulk-edit-description-editor-toolbar">
          <button
            aria-label={t('label.bold')}
            className="bulk-edit-description-editor-button"
            type="button"
            onClick={() => applyInlineFormat('**')}
            onMouseDown={handleToolbarMouseDown}>
            <Bold01 size={16} />
          </button>
          <button
            aria-label={t('label.italic')}
            className="bulk-edit-description-editor-button"
            type="button"
            onClick={() => applyInlineFormat('_')}
            onMouseDown={handleToolbarMouseDown}>
            <Italic01 size={16} />
          </button>
          <button
            aria-label={t('label.bulleted-list')}
            className="bulk-edit-description-editor-button"
            type="button"
            onClick={() => applyLineFormat(() => '- ')}
            onMouseDown={handleToolbarMouseDown}>
            <List size={16} />
          </button>
          <button
            aria-label={t('label.numbered-list')}
            className="bulk-edit-description-editor-button"
            type="button"
            onClick={() => applyLineFormat((index) => `${index + 1}. `)}
            onMouseDown={handleToolbarMouseDown}>
            <span className="bulk-edit-description-editor-numbered-icon">
              1.
            </span>
          </button>
          <button
            aria-label={t('label.code')}
            className="bulk-edit-description-editor-button"
            type="button"
            onClick={() => applyInlineFormat('`')}
            onMouseDown={handleToolbarMouseDown}>
            <Code01 size={16} />
          </button>
          <span className="bulk-edit-description-editor-separator" />
          <button
            aria-label={t('label.clear-formatting')}
            className="bulk-edit-description-editor-button"
            type="button"
            onClick={clearFormatting}
            onMouseDown={handleToolbarMouseDown}>
            <Type01 size={16} />
          </button>
        </div>
        <textarea
          className="bulk-edit-description-editor-textarea"
          ref={textareaRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
    </KeyDownStopPropagationWrapper>
  );
};

class CSVUtilsClassBase {
  public hideImportsColumnList() {
    return ['glossaryStatus', 'inspectionQuery'];
  }

  public columnsWithMultipleValuesEscapeNeeded() {
    return [
      'parent',
      'extension',
      'synonyms',
      'description',
      'tags',
      'glossaryTerms',
      'tiers',
      'relatedTerms',
      'column.description',
      'column.tags',
      'column.glossaryTerms',
      'storedProcedure.code',
      'column.name*',
      'name*',
      'parameterValues',
    ];
  }

  public getEditor(
    column: string,
    entityType: EntityType,
    multipleOwner: {
      user: boolean;
      team: boolean;
    },
    options: CSVEditorOptions = {}
  ):
    | ((
        props: RenderEditCellProps<Record<string, unknown>, unknown>
      ) => ReactNode)
    | undefined {
    switch (column) {
      case 'owner':
      case 'owners':
        if (options.usePlainTextEditor && entityType === EntityType.METRIC) {
          return getInlineBulkEditReferencePickerEditor(column, {
            includeTeams: multipleOwner.team,
          });
        }

        return ({
          row,
          onRowChange,
          onClose,
          column,
        }: RenderEditCellProps<Record<string, unknown>, unknown>) => {
          const value = row?.[column.key];
          const owners = value?.split(';') ?? [];
          const ownerEntityRef = owners.map((owner: string) => {
            const [type, user] = owner.split(':');

            return {
              type,
              name: user,
              id: user,
            } as EntityReference;
          });

          const handleChange = (owners?: EntityReference[]) => {
            if (!owners || owners.length === 0) {
              onRowChange({ ...row, [column.key]: '' }, true);

              return;
            }
            const ownerText = owners
              .map((owner) => `${owner.type}:${owner.name}`)
              .join(';');
            onRowChange({ ...row, [column.key]: ownerText }, true);
          };

          return (
            <UserTeamSelectableList
              hasPermission
              multiple={multipleOwner}
              owner={ownerEntityRef}
              popoverProps={{
                open: true,
              }}
              onClose={onClose}
              onUpdate={handleChange}>
              <ValueRendererOnEditCell>{value}</ValueRendererOnEditCell>
            </UserTeamSelectableList>
          );
        };
      case 'description':
        if (options.usePlainTextEditor) {
          return ({
            row,
            onRowChange,
            onClose,
            column,
          }: RenderEditCellProps<Record<string, unknown>, unknown>) => {
            const value = String(row[column.key] ?? '');
            const handleComplete = (description: string) => {
              if (description === value) {
                onClose(false);

                return;
              }

              onRowChange({ ...row, [column.key]: description }, true);
              onClose(true);
            };

            return (
              <InlineDescriptionEditor
                value={value}
                onCancel={() => onClose(false)}
                onComplete={handleComplete}
              />
            );
          };
        }

        return ({
          row,
          onRowChange,
          onClose,
          column,
        }: RenderEditCellProps<Record<string, unknown>, unknown>) => {
          const value = row[column.key];
          const handleSave = async (description: string) => {
            onRowChange({ ...row, [column.key]: description }, true);
          };

          return (
            <>
              <ValueRendererOnEditCell>{value}</ValueRendererOnEditCell>
              <ModalWithMarkdownEditor
                visible
                header="Edit Description"
                placeholder="Description"
                value={value}
                onCancel={() => onClose(false)}
                onSave={handleSave}
              />
            </>
          );
        };
      case 'tags':
        if (options.usePlainTextEditor && entityType === EntityType.METRIC) {
          return getInlineBulkEditReferencePickerEditor('tags');
        }

        return ({
          row,
          onRowChange,
          onClose,
          column,
        }: RenderEditCellProps<Record<string, unknown>, unknown>) => {
          const containerRef = useRef<HTMLDivElement | null>(null);
          const dropdownContainerRef = useRef<HTMLDivElement | null>(null);
          useMultiContainerFocusTrap({
            containers: [containerRef.current, dropdownContainerRef.current],
            active: true,
          });

          const tags = row[column.key]
            ? row[column.key]?.split(';').map(
                (tag: string) =>
                  ({
                    tagFQN: tag,
                    source: TagSource.Classification,
                    name: Fqn.split(tag).pop(),
                  } as TagLabel)
              )
            : undefined;

          const handleChange = (tags: TagLabel[]) => {
            onRowChange({
              ...row,
              [column.key]: tags.map((tag) => tag.tagFQN).join(';'),
            });
          };

          return (
            <KeyDownStopPropagationWrapper>
              <div ref={containerRef}>
                <InlineEdit
                  onCancel={() => onClose(false)}
                  onSave={() => onClose(true)}>
                  <TagSuggestion
                    autoFocus
                    dropdownContainerRef={dropdownContainerRef}
                    selectProps={{
                      className: 'react-grid-select-dropdown',
                      getPopupContainer: () => document.body,
                      size: 'small',
                    }}
                    value={tags}
                    onChange={handleChange}
                  />
                </InlineEdit>
              </div>
            </KeyDownStopPropagationWrapper>
          );
        };
      case 'relatedTerms':
      case 'glossaryTerms':
        if (
          column === 'glossaryTerms' &&
          options.usePlainTextEditor &&
          entityType === EntityType.METRIC
        ) {
          return getInlineBulkEditReferencePickerEditor('glossaryTerms');
        }

        return ({
          row,
          onRowChange,
          onClose,
          column,
        }: RenderEditCellProps<Record<string, unknown>, unknown>) => {
          const containerRef = useRef<HTMLDivElement | null>(null);
          const dropdownContainerRef = useRef<HTMLDivElement | null>(null);
          useMultiContainerFocusTrap({
            containers: [containerRef.current, dropdownContainerRef.current],
            active: true,
          });

          const value = row[column.key];
          const tags = value ? value?.split(';') : [];

          const handleChange = (
            option: DefaultOptionType | DefaultOptionType[]
          ) => {
            if (Array.isArray(option)) {
              onRowChange({
                ...row,
                [column.key]: option
                  .map((tag) => toString(tag.value))
                  .join(';'),
              });
            } else {
              onRowChange({
                ...row,
                [column.key]: toString(option.value),
              });
            }
          };

          return (
            <div ref={containerRef}>
              <TreeAsyncSelectList
                defaultValue={tags}
                dropdownContainerRef={dropdownContainerRef}
                optionClassName="tag-select-box"
                tagType={TagSource.Glossary}
                onCancel={() => {
                  onClose(false);
                }}
                onChange={handleChange}
                onSubmit={() => onClose(true)}
              />
            </div>
          );
        };
      case 'tiers':
        if (options.usePlainTextEditor && entityType === EntityType.METRIC) {
          return ({
            row,
            onRowChange,
            onClose,
            column,
          }: RenderEditCellProps<Record<string, unknown>, unknown>) => {
            const value = String(row[column.key] ?? '');
            const handleChange = (selectedValue: string) => {
              onRowChange({ ...row, [column.key]: selectedValue }, true);
              onClose(true);
            };

            return (
              <KeyDownStopPropagationWrapper>
                <Select
                  autoFocus
                  open
                  className="react-grid-select-dropdown bulk-edit-enum-select"
                  data-testid={`${column.key}-select`}
                  dropdownMatchSelectWidth={false}
                  dropdownStyle={{ minWidth: 220 }}
                  getPopupContainer={() => document.body}
                  menuItemSelectedIcon={<Check size={16} />}
                  optionFilterProp="label"
                  options={
                    entityBulkEditConfigClassBase.getEnumColumnOptions(
                      entityType
                    )[column.key]
                  }
                  popupClassName="bulk-edit-enum-select-dropdown"
                  size="small"
                  suffixIcon={<ChevronDown size={16} />}
                  value={value || undefined}
                  onChange={handleChange}
                />
              </KeyDownStopPropagationWrapper>
            );
          };
        }

        return ({
          row,
          onRowChange,
          onClose,
          column,
        }: RenderEditCellProps<Record<string, unknown>, unknown>) => {
          const value = row[column.key];
          const handleChange = async (tag?: Tag) => {
            onRowChange(
              {
                ...row,
                [column.key]: tag?.fullyQualifiedName,
              },
              true
            );
          };

          return (
            <TierCard
              currentTier={value}
              popoverProps={{ open: true }}
              updateTier={handleChange}
              onClose={() => onClose(false)}>
              <ValueRendererOnEditCell>{value}</ValueRendererOnEditCell>
            </TierCard>
          );
        };

      case 'certification':
        return ({
          row,
          onRowChange,
          onClose,
          column,
        }: RenderEditCellProps<Record<string, unknown>, unknown>) => {
          const value = row[column.key];
          const handleChange = async (tag?: Tag) => {
            onRowChange(
              {
                ...row,
                [column.key]: tag?.fullyQualifiedName,
              },
              true
            );
          };

          return (
            <Certification
              permission
              currentCertificate={value}
              popoverProps={{ open: true }}
              onCertificationUpdate={handleChange}
              onClose={() => onClose(false)}>
              <ValueRendererOnEditCell>{value}</ValueRendererOnEditCell>
            </Certification>
          );
        };
      case 'domains':
        if (options.usePlainTextEditor && entityType === EntityType.METRIC) {
          return getInlineBulkEditReferencePickerEditor('domains');
        }

        return ({
          row,
          onRowChange,
          column,
        }: RenderEditCellProps<Record<string, unknown>, unknown>) => {
          const value = row[column.key];
          const domains = value
            ? (value?.split(';') ?? []).map((domain: string) => {
                const fqn = removeOuterEscapes(domain.trim());

                return {
                  type: EntityType.DOMAIN,
                  name: fqn,
                  id: '',
                  fullyQualifiedName: fqn,
                };
              })
            : [];

          const handleChange = async (domain?: EntityReference[]) => {
            if (!domain || isEmpty(domain)) {
              onRowChange(
                {
                  ...row,
                  [column.key]: [],
                },
                true
              );

              return;
            }
            onRowChange(
              {
                ...row,
                [column.key]:
                  domain
                    .map((d) => {
                      const fqn = removeOuterEscapes(
                        d.fullyQualifiedName ?? ''
                      );

                      // Wrap in quotes to match CSV import format; escape any internal " for CSV safety
                      return `"${fqn.replace(/"/g, '""')}"`;
                    })
                    .join(';') ?? '',
              },
              true
            );
          };

          return (
            <DomainSelectableList
              hasPermission
              multiple
              getPopupContainer={() => document.body}
              popoverProps={{ open: true }}
              selectedDomain={domains}
              wrapInButton={false}
              onUpdate={(domain) => handleChange(domain as EntityReference[])}>
              <ValueRendererOnEditCell>{value}</ValueRendererOnEditCell>
            </DomainSelectableList>
          );
        };
      case 'reviewers':
        if (options.usePlainTextEditor && entityType === EntityType.METRIC) {
          return getInlineBulkEditReferencePickerEditor('reviewers');
        }

        return ({
          row,
          onRowChange,
          onClose,
          column,
        }: RenderEditCellProps<Record<string, unknown>, unknown>) => {
          const value = row[column.key];
          const reviewers = value?.split(';') ?? [];
          const reviewersEntityRef = reviewers.map((reviewer: string) => {
            const [type, user] = reviewer.split(':');

            return {
              type,
              name: user,
              id: user,
            } as EntityReference;
          });

          const handleChange = (reviewers?: EntityReference[]) => {
            if (!reviewers || reviewers.length === 0) {
              onRowChange(
                {
                  ...row,
                  [column.key]: '',
                },
                true
              );

              return;
            }
            const reviewerText = reviewers
              .map((reviewer) => `${reviewer.type}:${reviewer.name}`)
              .join(';');
            onRowChange(
              {
                ...row,
                [column.key]: reviewerText,
              },
              true
            );
          };

          return (
            <UserTeamSelectableList
              hasPermission
              previewSelected
              label={t('label.reviewer-plural')}
              listHeight={200}
              multiple={{ user: true, team: false }}
              owner={reviewersEntityRef}
              popoverProps={{
                open: true,
              }}
              onClose={onClose}
              onUpdate={handleChange}>
              <ValueRendererOnEditCell>{value}</ValueRendererOnEditCell>
            </UserTeamSelectableList>
          );
        };
      case 'extension':
        if (options.usePlainTextEditor && entityType === EntityType.METRIC) {
          return getInlineCustomPropertiesEditor(entityType);
        }

        return ({
          row,
          onRowChange,
          onClose,
          column,
        }: RenderEditCellProps<Record<string, unknown>, unknown>) => {
          const value = row[column.key];
          const handleSave = async (extension?: string) => {
            onRowChange({ ...row, [column.key]: extension }, true);
          };

          return (
            <>
              <ValueRendererOnEditCell>{value}</ValueRendererOnEditCell>
              <ModalWithCustomPropertyEditor
                visible
                entityType={getCustomPropertyEntityType(entityType)}
                header="Edit CustomProperty"
                value={value}
                onCancel={() => onClose(false)}
                onSave={handleSave}
              />
            </>
          );
        };
      case 'entityType*':
        return ({
          row,
          onRowChange,
          onClose,
          column,
        }: RenderEditCellProps<Record<string, unknown>, unknown>) => {
          const value = row[column.key];
          const handleChange = (typeValue: string) => {
            onRowChange({ ...row, [column.key]: typeValue });
          };
          const translatedEntityTypeOptions = () =>
            ENTITY_TYPE_OPTIONS.map((opt) => ({
              ...opt,
              label: t(opt.label),
            }));

          return (
            <KeyDownStopPropagationWrapper>
              <InlineEdit
                onCancel={() => onClose(false)}
                onSave={() => onClose(true)}>
                <Select
                  autoFocus
                  open
                  data-testid="entity-type-select"
                  options={translatedEntityTypeOptions()}
                  size="small"
                  style={{ width: '155px' }}
                  value={value}
                  onChange={handleChange}
                />
              </InlineEdit>
            </KeyDownStopPropagationWrapper>
          );
        };

      case 'relatedMetrics':
      case 'dataProducts':
        if (
          (column === 'dataProducts' || column === 'relatedMetrics') &&
          options.usePlainTextEditor &&
          entityType === EntityType.METRIC
        ) {
          return getInlineBulkEditReferencePickerEditor(column);
        }

        return ({
          row,
          onRowChange,
          onClose,
          column,
        }: RenderEditCellProps<Record<string, unknown>, unknown>) => {
          const value = row[column.key];
          const selected = value
            ? String(value).split(';').filter(Boolean)
            : [];
          const handleChange = (values: string[]) => {
            onRowChange({ ...row, [column.key]: values.join(';') }, true);
          };

          return (
            <KeyDownStopPropagationWrapper>
              <InlineEdit
                onCancel={() => onClose(false)}
                onSave={() => onClose(true)}>
                <Select
                  autoFocus
                  open
                  className="react-grid-select-dropdown"
                  getPopupContainer={() => document.body}
                  mode="tags"
                  placeholder={t('label.add-entity', {
                    entity: startCase(column.key),
                  })}
                  size="small"
                  value={selected}
                  onChange={handleChange}
                />
              </InlineEdit>
            </KeyDownStopPropagationWrapper>
          );
        };

      case 'expressionCode':
        return ({
          row,
          onRowChange,
          onClose,
          column,
        }: RenderEditCellProps<Record<string, unknown>, unknown>) => {
          const language = (row.expressionLanguage as Language) || Language.SQL;
          const handleCommit = (code: string, selectedLanguage: Language) => {
            onRowChange(
              {
                ...row,
                [column.key]: code,
                expressionLanguage: selectedLanguage,
              },
              true
            );
            onClose(true);
          };

          return (
            <>
              <ValueRendererOnEditCell>
                {row[column.key]}
              </ValueRendererOnEditCell>
              <ExpressionCodeCell
                language={language}
                value={String(row[column.key] ?? '')}
                onCancel={() => onClose(false)}
                onCommit={handleCommit}
              />
            </>
          );
        };

      case 'metricType':
      case 'unitOfMeasurement':
      case 'granularity':
      case 'entityStatus':
        return ({
          row,
          onRowChange,
          onClose,
          column,
        }: RenderEditCellProps<Record<string, unknown>, unknown>) => {
          const value = row[column.key];
          const handleChange = (selectedValue: string) => {
            onRowChange({ ...row, [column.key]: selectedValue }, true);
            onClose(true);
          };

          return (
            <KeyDownStopPropagationWrapper>
              <Select
                autoFocus
                open
                className="react-grid-select-dropdown bulk-edit-enum-select"
                data-testid={`${column.key}-select`}
                dropdownMatchSelectWidth={false}
                dropdownStyle={{ minWidth: 240 }}
                getPopupContainer={() => document.body}
                menuItemSelectedIcon={<Check size={16} />}
                optionFilterProp="label"
                options={
                  entityBulkEditConfigClassBase.getEnumColumnOptions(
                    entityType
                  )[column.key]
                }
                popupClassName="bulk-edit-enum-select-dropdown"
                size="small"
                suffixIcon={<ChevronDown size={16} />}
                value={value || undefined}
                onChange={handleChange}
              />
            </KeyDownStopPropagationWrapper>
          );
        };

      case 'code':
        if (options.usePlainTextEditor) {
          return getInlineTextCellEditor();
        }

        return ({
          row,
          onRowChange,
          onClose,
          column,
        }: RenderEditCellProps<Record<string, unknown>, unknown>) => {
          const value = row[column.key];
          const handleChange = (value: string) => {
            onRowChange({ ...row, [column.key]: value });
          };

          return (
            <>
              <ValueRendererOnEditCell>{value}</ValueRendererOnEditCell>
              <SchemaModal
                isFooterVisible
                visible
                data={value}
                editorClass="custom-code-mirror-theme full-screen-editor-height"
                mode={{ name: CSMode.SQL }}
                onChange={handleChange}
                onClose={() => onClose(false)}
                onSave={() => onClose(true)}
              />
            </>
          );
        };
      default:
        if (options.usePlainTextEditor) {
          return getInlineTextCellEditor();
        }

        return lazyTextEditor;
    }
  }
}

const csvUtilsClassBase = new CSVUtilsClassBase();

export default csvUtilsClassBase;
export { CSVUtilsClassBase };
