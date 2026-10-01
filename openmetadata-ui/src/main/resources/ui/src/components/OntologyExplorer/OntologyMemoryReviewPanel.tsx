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

import { Alert, Button, Typography } from '@openmetadata/ui-core-components';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  OntologyChangeOperation,
  OntologyChangeSet,
  OntologyChangeSetState,
  OperationType,
} from '../../generated/entity/data/ontologyChangeSet';
import {
  applyOntologyChangeSet,
  listOntologyChangeSets,
  submitOntologyChangeSet,
} from '../../rest/ontologyAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { useOntologyEditLease } from './hooks/useOntologyEditLease';

interface OntologyMemoryReviewPanelProps {
  canApply: boolean;
  canSubmit: boolean;
  initialDraftId?: string;
  onApplied: () => void;
}

function isMemoryProposal(changeSet: OntologyChangeSet): boolean {
  return changeSet.operations.some(
    (operation) => (operation.sourceMemoryIds?.length ?? 0) > 0
  );
}

function isReviewable(changeSet: OntologyChangeSet): boolean {
  return (
    changeSet.state === OntologyChangeSetState.Draft ||
    changeSet.state === OntologyChangeSetState.Submitted ||
    changeSet.state === OntologyChangeSetState.ApplyFailed
  );
}

function operationName(operation: OntologyChangeOperation): string {
  if (operation.operationType === OperationType.CreateGlossary) {
    return operation.glossary?.displayName || operation.glossary?.name || '';
  }

  return operation.term?.displayName || operation.term?.name || '';
}

function DraftList({
  changeSets,
  selectedId,
  onSelect,
}: {
  changeSets: OntologyChangeSet[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="tw:flex tw:flex-col tw:gap-2">
      {changeSets.map((changeSet) => (
        <li key={changeSet.id}>
          <Button
            noTextPadding
            aria-pressed={selectedId === changeSet.id}
            className="tw:w-full tw:justify-start tw:rounded-lg tw:border tw:border-secondary tw:bg-primary tw:p-3 tw:text-left"
            color="tertiary"
            data-testid={`ontology-memory-draft-${changeSet.id}`}
            onPress={() => onSelect(changeSet.id)}>
            <span className="tw:flex tw:flex-col tw:gap-1">
              <span className="tw:font-semibold">
                {changeSet.displayName || changeSet.name}
              </span>
              <span className="tw:text-xs tw:text-tertiary">
                {changeSet.glossaries
                  .map((glossary) => glossary.displayName || glossary.name)
                  .join(', ')}
                {' · '}
                {changeSet.state}
              </span>
            </span>
          </Button>
        </li>
      ))}
    </ul>
  );
}

function OperationCard({ operation }: { operation: OntologyChangeOperation }) {
  const { t } = useTranslation();
  const description =
    operation.term?.description || operation.glossary?.description;

  return (
    <li className="tw:rounded-lg tw:border tw:border-secondary tw:p-4">
      <Typography as="h3" size="text-sm" weight="semibold">
        {operationName(operation)}
      </Typography>
      <Typography as="p" className="tw:text-tertiary" size="text-xs">
        {operation.operationType}
      </Typography>
      {description ? (
        <Typography as="p" className="tw:mt-2" size="text-sm">
          {description}
        </Typography>
      ) : null}
      {operation.rationale ? (
        <Typography as="p" className="tw:mt-2" size="text-sm">
          {operation.rationale}
        </Typography>
      ) : null}
      {operation.confidence !== undefined ? (
        <Typography as="p" className="tw:mt-2" size="text-xs">
          {t('label.confidence')}: {Math.round(operation.confidence * 100)}%
        </Typography>
      ) : null}
      {operation.sourceMemoryIds?.length ? (
        <Typography as="p" className="tw:mt-2" size="text-xs">
          {t('label.memory')}: {operation.sourceMemoryIds.join(', ')}
        </Typography>
      ) : null}
    </li>
  );
}

function DraftDetail({
  changeSet,
  canApply,
  canSubmit,
  isLeaseOwned,
  isSaving,
  onApply,
  onSubmit,
}: {
  changeSet: OntologyChangeSet;
  canApply: boolean;
  canSubmit: boolean;
  isLeaseOwned: boolean;
  isSaving: boolean;
  onApply: () => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();
  const showSubmit =
    changeSet.state === OntologyChangeSetState.Draft && canSubmit;
  const showApply =
    canApply &&
    (changeSet.state === OntologyChangeSetState.Submitted ||
      changeSet.state === OntologyChangeSetState.ApplyFailed);
  const applyError = changeSet.applicationResult?.results
    .map((result) => result.message)
    .filter(Boolean)
    .join('; ');

  return (
    <section className="tw:flex tw:flex-col tw:gap-4 tw:rounded-lg tw:border tw:border-secondary tw:bg-primary tw:p-5">
      <div className="tw:flex tw:items-start tw:justify-between tw:gap-4">
        <div>
          <Typography as="h2" size="text-lg" weight="semibold">
            {changeSet.displayName || changeSet.name}
          </Typography>
          <Typography as="p" className="tw:text-tertiary" size="text-sm">
            {changeSet.description}
          </Typography>
        </div>
        <span className="tw:text-sm tw:font-semibold tw:text-brand-secondary">
          {changeSet.state}
        </span>
      </div>

      <div>
        <Typography as="h3" size="text-sm" weight="semibold">
          {t('label.glossary')}
        </Typography>
        <Typography as="p" size="text-sm">
          {changeSet.glossaries
            .map((glossary) => glossary.displayName || glossary.name)
            .join(', ')}
        </Typography>
      </div>

      <ul className="tw:flex tw:flex-col tw:gap-3">
        {changeSet.operations.map((operation) => (
          <OperationCard key={operation.id} operation={operation} />
        ))}
      </ul>

      {applyError ? <Alert title={applyError} variant="error" /> : null}

      <div className="tw:flex tw:justify-end tw:gap-2">
        {showSubmit ? (
          <Button
            color="secondary"
            data-testid="ontology-memory-submit"
            isDisabled={!isLeaseOwned || isSaving}
            isLoading={isSaving}
            onPress={onSubmit}>
            {t('label.submit')}
          </Button>
        ) : null}
        {showApply ? (
          <Button
            color="primary"
            data-testid="ontology-memory-apply"
            isDisabled={!isLeaseOwned || isSaving}
            isLoading={isSaving}
            onPress={onApply}>
            {t('label.apply')}
          </Button>
        ) : null}
      </div>
    </section>
  );
}

const OntologyMemoryReviewPanel = ({
  canApply,
  canSubmit,
  initialDraftId,
  onApplied,
}: OntologyMemoryReviewPanelProps) => {
  const { t } = useTranslation();
  const [changeSets, setChangeSets] = useState<OntologyChangeSet[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(
    initialDraftId
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const selected =
    changeSets.find((changeSet) => changeSet.id === selectedId) ??
    changeSets[0];
  const lease = useOntologyEditLease({
    isActive: Boolean(selected && (canSubmit || canApply)),
    resourceId: selected?.id,
    resourceType: 'ontologyChangeSet',
  });

  const loadChangeSets = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = { fields: 'operations', limit: 100 };
      const responses = await Promise.all([
        listOntologyChangeSets({
          ...params,
          state: OntologyChangeSetState.Draft,
        }),
        listOntologyChangeSets({
          ...params,
          state: OntologyChangeSetState.Submitted,
        }),
        listOntologyChangeSets({
          ...params,
          state: OntologyChangeSetState.ApplyFailed,
        }),
      ]);
      const proposals = responses
        .flatMap((response) => response.data)
        .filter(
          (changeSet, index, all) =>
            isMemoryProposal(changeSet) &&
            isReviewable(changeSet) &&
            all.findIndex((candidate) => candidate.id === changeSet.id) ===
              index
        )
        .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
      setChangeSets(proposals);
      setSelectedId((current) =>
        proposals.some((proposal) => proposal.id === current)
          ? current
          : proposals[0]?.id
      );
    } catch {
      showErrorToast(t('server.unexpected-error'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadChangeSets();
  }, [loadChangeSets]);

  const handleAction = async (action: 'submit' | 'apply') => {
    if (!selected || !lease.isOwned || !lease.lock) {
      return;
    }

    setIsSaving(true);
    const request = {
      lease: {
        sessionId: lease.lock.sessionId,
        version: lease.lock.version,
      },
    };
    try {
      const updated =
        action === 'submit'
          ? await submitOntologyChangeSet(selected.id, request)
          : await applyOntologyChangeSet(selected.id, request);
      if (updated.state === OntologyChangeSetState.Applied) {
        setChangeSets((current) =>
          current.filter((changeSet) => changeSet.id !== selected.id)
        );
        setSelectedId(undefined);
        onApplied();
      } else {
        setChangeSets((current) =>
          current.map((changeSet) =>
            changeSet.id === selected.id ? updated : changeSet
          )
        );
      }
      if (updated.state === OntologyChangeSetState.ApplyFailed) {
        showErrorToast(t('server.unexpected-error'));
      } else {
        showSuccessToast(
          action === 'submit' ? t('label.submit') : t('label.ontology-applied')
        );
      }
    } catch {
      showErrorToast(t('server.unexpected-error'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="tw:min-h-0 tw:min-w-0 tw:flex-1 tw:overflow-auto tw:bg-secondary tw:p-6"
      data-testid="ontology-memory-review-panel">
      <div className="tw:mx-auto tw:flex tw:max-w-screen-2xl tw:flex-col tw:gap-6">
        <div className="tw:flex tw:items-start tw:justify-between tw:gap-4">
          <div>
            <Typography as="h1" size="display-xs" weight="semibold">
              {t('label.needs-review')}
            </Typography>
            <Typography
              as="p"
              className="tw:mt-1 tw:text-tertiary"
              size="text-sm">
              {t('message.ontology-ai-proposal-draft-description')}
            </Typography>
          </div>
          <Button
            color="secondary"
            isLoading={isLoading}
            onPress={loadChangeSets}>
            {t('label.refresh')}
          </Button>
        </div>

        {!isLoading && changeSets.length === 0 ? (
          <Alert title={t('label.no-data')} variant="gray" />
        ) : null}

        {changeSets.length > 0 ? (
          <div className="tw:grid tw:gap-4 tw:lg:grid-cols-[minmax(240px,1fr)_minmax(0,2fr)]">
            <DraftList
              changeSets={changeSets}
              selectedId={selected?.id}
              onSelect={setSelectedId}
            />

            {selected ? (
              <DraftDetail
                canApply={canApply}
                canSubmit={canSubmit}
                changeSet={selected}
                isLeaseOwned={lease.isOwned}
                isSaving={isSaving}
                onApply={() => void handleAction('apply')}
                onSubmit={() => void handleAction('submit')}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default OntologyMemoryReviewPanel;
