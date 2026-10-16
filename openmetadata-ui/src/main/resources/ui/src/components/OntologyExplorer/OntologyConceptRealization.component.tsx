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
  Badge,
  Box,
  Button,
  ButtonUtility,
  FilterSelect,
  FilterSelectOption,
  Label,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Database01,
  Plus,
  XClose,
} from '@openmetadata/ui-core-components/icons';
import { useControlledState } from '@react-stately/utils';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { Operation } from 'fast-json-patch';
import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { SearchIndex } from '../../enums/search.enum';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import {
  AssetRealization,
  RealizationRole,
} from '../../generated/type/assetRealization';
import { patchGlossaryTerm } from '../../rest/glossaryAPI';
import { searchQuery } from '../../rest/searchAPI';
import Fqn from '../../utils/Fqn';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import {
  InspectorForm,
  InspectorList,
  InspectorRemoveButton,
  InspectorRow,
  InspectorSection,
  InspectorSectionHeading,
} from './OntologyInspectorSection';

export interface OntologyConceptRealizationProps {
  readonly termId?: string;
  readonly realizations: AssetRealization[];
  readonly isEditMode?: boolean;
  readonly variant?: 'default' | 'inspector';
  readonly onTermUpdate?: (term: GlossaryTerm) => void;
  /** Lets the parent drawer open the add form, e.g. from its "Add more details" chips. */
  readonly isAdding?: boolean;
  readonly onAddingChange?: (isAdding: boolean) => void;
}

const ASSET_PAGE_SIZE = 10;

const getCandidateLabel = (candidate: AssetCandidate): string =>
  candidate.displayName ?? candidate.name;

// The containers above the asset, e.g. "service / database / schema".
const getCandidatePath = (candidate: AssetCandidate): string =>
  candidate.fullyQualifiedName
    ? Fqn.split(candidate.fullyQualifiedName).slice(0, -1).join(' / ')
    : '';

interface AssetCandidate {
  id: string;
  name: string;
  displayName?: string;
  fullyQualifiedName?: string;
}

const ROLE_BADGE_COLORS: Record<RealizationRole, 'success' | 'blue' | 'gray'> =
  {
    [RealizationRole.PrimaryStore]: 'success',
    [RealizationRole.Derived]: 'blue',
    [RealizationRole.Replica]: 'gray',
  };

const ROLE_LABEL_KEYS: Record<RealizationRole, string> = {
  [RealizationRole.PrimaryStore]: 'label.primary-store',
  [RealizationRole.Derived]: 'label.derived-copy',
  [RealizationRole.Replica]: 'label.replica',
};

const ROLE_HINT_KEYS: Record<RealizationRole, string> = {
  [RealizationRole.PrimaryStore]: 'message.realization-role-primary-store-hint',
  [RealizationRole.Derived]: 'message.realization-role-derived-hint',
  [RealizationRole.Replica]: 'message.realization-role-replica-hint',
};

const ROLE_ORDER: RealizationRole[] = [
  RealizationRole.PrimaryStore,
  RealizationRole.Derived,
  RealizationRole.Replica,
];

/**
 * Lists the data assets that store a concept's instances. This is a stronger claim than a tag
 * label, which only records that an asset references the concept.
 */
export const OntologyConceptRealization: React.FC<
  OntologyConceptRealizationProps
> = ({
  termId,
  realizations,
  isEditMode = false,
  variant = 'default',
  isAdding: controlledIsAdding,
  onAddingChange,
  onTermUpdate,
}) => {
  const { t } = useTranslation();
  const isInspector = variant === 'inspector';
  const canAuthor = isEditMode && Boolean(termId);
  const [isAdding, setIsAdding] = useControlledState(
    controlledIsAdding,
    false,
    onAddingChange
  );
  const [isSaving, setIsSaving] = useState(false);
  const assetLabelId = useId();
  const [candidates, setCandidates] = useState<AssetCandidate[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  // A slower earlier search must not overwrite the results of a later one.
  const searchRequestRef = useRef(0);
  const [selectedAsset, setSelectedAsset] = useState<AssetCandidate | null>(
    null
  );
  const [draftRole, setDraftRole] = useState<RealizationRole>(
    RealizationRole.PrimaryStore
  );

  const resetDraft = useCallback(() => {
    setCandidates([]);
    setSelectedAsset(null);
    setDraftRole(RealizationRole.PrimaryStore);
    setIsAdding(false);
  }, [setIsAdding]);

  const persist = useCallback(
    async (value: AssetRealization[]) => {
      if (!termId) {
        return;
      }
      const operation: Operation = {
        op: 'add',
        path: '/realizedIn',
        value,
      };
      setIsSaving(true);
      try {
        const updatedTerm = await patchGlossaryTerm(termId, [operation]);
        onTermUpdate?.(updatedTerm);
        showSuccessToast(
          t('server.update-entity-success', { entity: t('label.realized-in') })
        );
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.entity-updating-error', { entity: t('label.realized-in') })
        );
      } finally {
        setIsSaving(false);
      }
    },
    [onTermUpdate, t, termId]
  );

  // An empty query lists the first tables, so the field never opens empty.
  const loadCandidates = useCallback(async (value: string) => {
    searchRequestRef.current += 1;
    const requestId = searchRequestRef.current;
    setIsSearching(true);
    try {
      const response = await searchQuery({
        pageNumber: 1,
        pageSize: ASSET_PAGE_SIZE,
        searchIndex: SearchIndex.TABLE,
        query: value.trim() ? `*${value.trim()}*` : '',
      });
      if (requestId === searchRequestRef.current) {
        setCandidates(
          response.hits.hits.map((hit) => ({
            id: hit._source.id ?? '',
            name: hit._source.name,
            displayName: hit._source.displayName,
            fullyQualifiedName: hit._source.fullyQualifiedName,
          }))
        );
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (isAdding) {
      void loadCandidates('');
    }
  }, [isAdding, loadCandidates]);

  // The chosen asset stays listed after a new search, so it keeps its icon and
  // path instead of falling back to a bare label.
  const listedCandidates = useMemo(
    () =>
      selectedAsset &&
      !candidates.some((candidate) => candidate.id === selectedAsset.id)
        ? [selectedAsset, ...candidates]
        : candidates,
    [candidates, selectedAsset]
  );

  const assetOptions = useMemo<FilterSelectOption[]>(
    () =>
      listedCandidates.map((candidate) => ({
        icon: Database01,
        label: (
          <span className="tw:flex tw:min-w-0 tw:flex-col">
            <span className="tw:truncate tw:text-sm tw:font-medium tw:text-primary">
              {getCandidateLabel(candidate)}
            </span>
            <span className="tw:truncate tw:text-xs tw:text-tertiary">
              {[getCandidatePath(candidate), t('label.table')]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </span>
        ),
        textValue: getCandidateLabel(candidate),
        value: candidate.id,
      })),
    [listedCandidates, t]
  );

  const handleAssetChange = useCallback(
    ([assetId]: string[]) =>
      setSelectedAsset(
        listedCandidates.find((candidate) => candidate.id === assetId) ?? null
      ),
    [listedCandidates]
  );

  const renderAssetField = () => (
    <Box direction="col" gap={1}>
      <Label isRequired id={assetLabelId}>
        {t('label.data-asset')}
      </Label>
      <FilterSelect
        hideCounts
        searchable
        aria-labelledby={assetLabelId}
        data-testid="realization-asset-input"
        isClearable={false}
        isLoading={isSearching}
        label={t('label.data-asset')}
        options={assetOptions}
        placeholder={t('message.realization-asset-placeholder')}
        popoverClassName="tw:w-(--trigger-width)"
        selectedValues={selectedAsset ? [selectedAsset.id] : []}
        selectionMode="single"
        triggerVariant="input"
        onChange={handleAssetChange}
        onSearch={(text) => void loadCandidates(text)}
      />
    </Box>
  );

  const handleAdd = useCallback(async () => {
    if (!selectedAsset) {
      return;
    }
    await persist([
      ...realizations,
      {
        asset: {
          id: selectedAsset.id,
          type: 'table',
          name: selectedAsset.name,
          fullyQualifiedName: selectedAsset.fullyQualifiedName,
        },
        role: draftRole,
      },
    ]);
    resetDraft();
  }, [draftRole, persist, realizations, resetDraft, selectedAsset]);

  const handleRemove = useCallback(
    async (assetId: string) => {
      await persist(
        realizations.filter((realization) => realization.asset.id !== assetId)
      );
    },
    [persist, realizations]
  );

  const renderRealizationContent = (realization: AssetRealization) => {
    const role = realization.role ?? RealizationRole.PrimaryStore;

    return (
      <>
        <Typography
          className="tw:min-w-0 tw:flex-1 tw:truncate tw:text-primary"
          size="text-sm"
          weight="medium">
          {realization.asset.displayName ?? realization.asset.name}
        </Typography>
        <Badge color="gray" size="sm" type="color">
          {realization.asset.type}
        </Badge>
        <Badge color={ROLE_BADGE_COLORS[role]} size="sm" type="color">
          {t(ROLE_LABEL_KEYS[role])}
        </Badge>
        {canAuthor ? (
          <ButtonUtility
            color="tertiary"
            data-testid={`remove-realization-${realization.asset.name}`}
            icon={XClose}
            isDisabled={isSaving}
            size="xs"
            tooltip={t('label.remove')}
            onClick={() => handleRemove(realization.asset.id)}
          />
        ) : null}
      </>
    );
  };

  const renderInspectorRealization = (realization: AssetRealization) => {
    const role = realization.role ?? RealizationRole.PrimaryStore;

    return (
      <InspectorRow
        key={realization.asset.id}
        testId={`concept-realization-${realization.asset.name}`}>
        <Box
          align="center"
          className="tw:size-7 tw:shrink-0 tw:rounded-md tw:bg-utility-gray-blue-50 tw:text-utility-gray-blue-600"
          justify="center">
          <Database01 aria-hidden="true" className="tw:size-4" />
        </Box>
        <Box className="tw:min-w-0 tw:flex-1" direction="col">
          <Typography
            ellipsis
            className="tw:text-primary"
            size="text-sm"
            weight="medium">
            {realization.asset.displayName ?? realization.asset.name}
          </Typography>
          {realization.asset.fullyQualifiedName ? (
            <Typography ellipsis className="tw:text-tertiary" size="text-xs">
              {realization.asset.fullyQualifiedName}
            </Typography>
          ) : null}
        </Box>
        <Badge color={ROLE_BADGE_COLORS[role]} size="sm" type="pill-color">
          {t(ROLE_LABEL_KEYS[role])}
        </Badge>
        {canAuthor ? (
          <InspectorRemoveButton
            isDisabled={isSaving}
            label={t('label.remove-entity', {
              entity: realization.asset.displayName ?? realization.asset.name,
            })}
            testId={`remove-realization-${realization.asset.name}`}
            onRemove={() => handleRemove(realization.asset.id)}
          />
        ) : null}
      </InspectorRow>
    );
  };

  const renderRealization = (realization: AssetRealization) =>
    isInspector ? (
      renderInspectorRealization(realization)
    ) : (
      <div
        className="tw:flex tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-secondary tw:bg-secondary tw:p-3"
        data-testid={`concept-realization-${realization.asset.name}`}
        key={realization.asset.id}>
        {renderRealizationContent(realization)}
      </div>
    );

  const renderAddForm = () => (
    <div
      className="tw:flex tw:flex-col tw:gap-2 tw:rounded-lg tw:border tw:border-dashed tw:border-primary tw:bg-secondary tw:p-2.5"
      data-testid="realization-add-form">
      {renderAssetField()}
      <div className="tw:flex tw:flex-wrap tw:gap-1">
        {ROLE_ORDER.map((role) => (
          <Button
            color={draftRole === role ? 'primary' : 'secondary'}
            data-testid={`realization-role-${role}`}
            key={role}
            size="sm"
            onClick={() => setDraftRole(role)}>
            {t(ROLE_LABEL_KEYS[role])}
          </Button>
        ))}
      </div>
      <div className="tw:flex tw:justify-end tw:gap-2">
        <Button color="tertiary" size="sm" onClick={resetDraft}>
          {t('label.cancel')}
        </Button>
        <Button
          color="primary"
          data-testid="save-realization"
          isDisabled={!selectedAsset || isSaving}
          size="sm"
          onClick={handleAdd}>
          {t('label.add')}
        </Button>
      </div>
    </div>
  );

  const addLabel = t('label.add-entity', { entity: t('label.realized-in') });

  const renderInspectorForm = () => (
    <InspectorForm
      isSubmitDisabled={!selectedAsset || isSaving}
      submitLabel={t('label.add-entity', { entity: t('label.realization') })}
      submitTestId="save-realization"
      testId="realization-add-form"
      title={t('label.new-entity', { entity: t('label.realization') })}
      onCancel={resetDraft}
      onSubmit={handleAdd}>
      {renderAssetField()}
      <Box direction="col" gap={1}>
        <Typography
          className="tw:text-secondary"
          size="text-sm"
          weight="medium">
          {t('label.role')}
        </Typography>
        <Tabs
          selectedKey={draftRole}
          onSelectionChange={(key) => setDraftRole(key as RealizationRole)}>
          <Tabs.List fullWidth size="sm" type="button-border">
            {ROLE_ORDER.map((role) => (
              <Tabs.Item
                data-testid={`realization-role-${role}`}
                id={role}
                key={role}>
                {t(ROLE_LABEL_KEYS[role])}
              </Tabs.Item>
            ))}
          </Tabs.List>
        </Tabs>
        <Typography className="tw:text-tertiary" size="text-xs">
          {t(ROLE_HINT_KEYS[draftRole])}
        </Typography>
      </Box>
    </InspectorForm>
  );

  const renderInspectorSection = () => (
    <InspectorSection testId="ontology-realizations">
      <InspectorSectionHeading
        addTestId="add-realization"
        count={realizations.length}
        label={t('label.realized-in')}
        onAdd={canAuthor && !isAdding ? () => setIsAdding(true) : undefined}
      />
      {realizations.length > 0 ? (
        <InspectorList>{realizations.map(renderRealization)}</InspectorList>
      ) : null}
      {canAuthor && isAdding ? renderInspectorForm() : null}
    </InspectorSection>
  );

  const renderDefaultSection = () => (
    <div
      className="tw:flex tw:flex-col tw:gap-2"
      data-testid="ontology-realizations">
      <div className="tw:mb-1 tw:flex tw:items-center tw:gap-2">
        <Typography as="h3" size="text-sm" weight="semibold">
          {t('label.realized-in')}
        </Typography>
        <Badge color="gray" size="sm" type="color">
          {realizations.length}
        </Badge>
      </div>
      {realizations.map(renderRealization)}
      {canAuthor && isAdding && renderAddForm()}
      {canAuthor && !isAdding && (
        <Button
          noTextPadding
          className={classNames(
            'tw:flex tw:w-full tw:items-center tw:justify-center tw:gap-1 tw:rounded-lg tw:border tw:border-dashed',
            'tw:border-primary tw:bg-primary tw:px-2.5 tw:py-2 tw:font-body tw:text-xs tw:font-semibold tw:text-secondary tw:*:data-icon:size-3'
          )}
          color="tertiary"
          data-testid="add-realization"
          iconLeading={Plus}
          onClick={() => setIsAdding(true)}>
          {addLabel}
        </Button>
      )}
    </div>
  );

  return isInspector ? renderInspectorSection() : renderDefaultSection();
};
