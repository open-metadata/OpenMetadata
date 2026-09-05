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
  Button,
  ButtonUtility,
  Input,
  Typography,
} from '@openmetadata/ui-core-components';
import { Plus, XClose } from '@untitledui/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { Operation } from 'fast-json-patch';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchIndex } from '../../enums/search.enum';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import {
  AssetRealization,
  RealizationRole,
} from '../../generated/type/assetRealization';
import { patchGlossaryTerm } from '../../rest/glossaryAPI';
import { searchQuery } from '../../rest/searchAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';

export interface OntologyConceptRealizationProps {
  readonly termId?: string;
  readonly realizations: AssetRealization[];
  readonly isEditMode?: boolean;
  readonly variant?: 'default' | 'inspector';
  readonly onTermUpdate?: (term: GlossaryTerm) => void;
}

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
  onTermUpdate,
}) => {
  const { t } = useTranslation();
  const isInspector = variant === 'inspector';
  const canAuthor = isEditMode && Boolean(termId);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [assetQuery, setAssetQuery] = useState('');
  const [candidates, setCandidates] = useState<AssetCandidate[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<AssetCandidate | null>(
    null
  );
  const [draftRole, setDraftRole] = useState<RealizationRole>(
    RealizationRole.PrimaryStore
  );

  const resetDraft = useCallback(() => {
    setAssetQuery('');
    setCandidates([]);
    setSelectedAsset(null);
    setDraftRole(RealizationRole.PrimaryStore);
    setIsAdding(false);
  }, []);

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

  const handleSearch = useCallback(async (value: string) => {
    setAssetQuery(value);
    setSelectedAsset(null);
    if (value.trim().length < 2) {
      setCandidates([]);

      return;
    }
    try {
      const response = await searchQuery({
        pageNumber: 1,
        pageSize: 5,
        searchIndex: SearchIndex.TABLE,
        query: `*${value.trim()}*`,
      });
      setCandidates(
        response.hits.hits.map((hit) => ({
          id: hit._source.id ?? '',
          name: hit._source.name,
          displayName: hit._source.displayName,
          fullyQualifiedName: hit._source.fullyQualifiedName,
        }))
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, []);

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

  const renderRealization = (realization: AssetRealization) => {
    const role = realization.role ?? RealizationRole.PrimaryStore;

    return (
      <div
        className={classNames(
          'tw:flex tw:items-center tw:gap-2 tw:border tw:border-secondary tw:bg-secondary',
          isInspector
            ? 'tw:rounded-lg tw:px-2.5 tw:py-2'
            : 'tw:rounded-lg tw:p-3'
        )}
        data-testid={`concept-realization-${realization.asset.name}`}
        key={realization.asset.id}>
        <span className="tw:min-w-0 tw:flex-1 tw:truncate tw:font-mono tw:text-xs tw:leading-normal tw:font-medium tw:text-primary">
          {realization.asset.displayName ?? realization.asset.name}
        </span>
        <Badge color="gray" size="sm" type="color">
          {realization.asset.type}
        </Badge>
        <Badge color={ROLE_BADGE_COLORS[role]} size="sm" type="color">
          {t(ROLE_LABEL_KEYS[role])}
        </Badge>
        {canAuthor ? (
          <ButtonUtility
            data-testid={`remove-realization-${realization.asset.name}`}
            icon={XClose}
            isDisabled={isSaving}
            size="xs"
            tooltip={t('label.remove')}
            onClick={() => handleRemove(realization.asset.id)}
          />
        ) : null}
      </div>
    );
  };

  const renderAddForm = () => (
    <div
      className="tw:flex tw:flex-col tw:gap-2 tw:rounded-lg tw:border tw:border-dashed tw:border-primary tw:bg-secondary tw:p-2.5"
      data-testid="realization-add-form">
      <Input
        aria-label={t('label.data-asset')}
        data-testid="realization-asset-input"
        placeholder={t('label.data-asset')}
        value={assetQuery}
        onChange={handleSearch}
      />
      {candidates.length > 0 ? (
        <div className="tw:flex tw:flex-col tw:gap-1">
          {candidates.map((candidate) => (
            <Button
              ellipsis
              noTextPadding
              className={classNames(
                'tw:justify-start tw:rounded tw:px-2 tw:py-1 tw:text-left tw:font-mono tw:text-[11px]',
                selectedAsset?.id === candidate.id
                  ? 'tw:bg-brand-solid tw:text-white'
                  : 'tw:bg-primary tw:text-secondary'
              )}
              color="tertiary"
              data-testid={`realization-candidate-${candidate.name}`}
              key={candidate.id}
              onClick={() => setSelectedAsset(candidate)}>
              {candidate.fullyQualifiedName ?? candidate.name}
            </Button>
          ))}
        </div>
      ) : null}
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

  return (
    <div
      className={classNames(
        'tw:flex tw:flex-col',
        isInspector ? 'tw:gap-1.5' : 'tw:gap-2'
      )}
      data-testid="ontology-realizations">
      <div className="tw:mb-1 tw:flex tw:items-center tw:gap-2">
        <Typography as="h3" size="text-sm" weight="semibold">
          {t('label.realized-in')}
        </Typography>
        <Badge color="gray" size="sm" type="color">
          {realizations.length}
        </Badge>
      </div>
      {realizations.length === 0 ? (
        <Typography as="p" className="tw:text-tertiary" size="text-xs">
          {t('message.no-concept-realization')}
        </Typography>
      ) : (
        realizations.map(renderRealization)
      )}
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
          {t('label.add-entity', { entity: t('label.realized-in') })}
        </Button>
      )}
    </div>
  );
};
