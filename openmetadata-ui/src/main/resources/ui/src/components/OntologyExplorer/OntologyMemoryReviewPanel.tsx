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
import { useQueries } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { TFunction } from 'i18next';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants/constants';
import {
  OntologyChangeOperation,
  OntologyChangeSet,
  OntologyChangeSetState,
  OperationType,
} from '../../generated/entity/data/ontologyChangeSet';
import { getContextMemoryById } from '../../rest/contextMemoryAPI';
import {
  applyOntologyChangeSet,
  discardOntologyChangeSet,
  getOntologyChangeSet,
  listOntologyChangeSets,
  submitOntologyChangeSet,
} from '../../rest/ontologyAPI';
import { getEntityName } from '../../utils/EntityNameUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { useOntologyEditLease } from './hooks/useOntologyEditLease';

interface OntologyMemoryReviewPanelProps {
  canApply: boolean;
  canDiscard: boolean;
  canSubmit: boolean;
  initialDraftId?: string;
  onApplied: () => void;
}

type DraftAction = 'submit' | 'apply' | 'discard';

const CHANGE_SET_FIELDS = 'operations';
const PAGE_SIZE = 50;
const REVIEWABLE_STATES = [
  OntologyChangeSetState.Draft,
  OntologyChangeSetState.Submitted,
  OntologyChangeSetState.ApplyFailed,
];
const STATE_LABEL_KEYS: Partial<Record<OntologyChangeSetState, string>> = {
  [OntologyChangeSetState.Draft]: 'label.draft',
  [OntologyChangeSetState.Submitted]: 'label.in-review',
  [OntologyChangeSetState.ApplyFailed]: 'label.failed',
};
const LINK_CLASS_NAME = 'tw:text-link tw:hover:underline';
const SOURCE_MEMORY_QUERY_KEY = 'ontologyDraftSourceMemory';
const SOURCE_MEMORY_STALE_TIME_MS = 60_000;

function stateLabel(state: OntologyChangeSetState, t: TFunction): string {
  const key = STATE_LABEL_KEYS[state];

  return key ? t(key) : state;
}

function operationTypeLabel(type: OperationType, t: TFunction): string {
  switch (type) {
    case OperationType.CreateGlossary:
      return t('label.new-entity', { entity: t('label.glossary') });
    case OperationType.CreateTerm:
      return t('label.new-entity', { entity: t('label.glossary-term') });
    default:
      return type;
  }
}

function isMemoryProposal(changeSet: OntologyChangeSet): boolean {
  return changeSet.operations.some(
    (operation) => (operation.sourceMemoryIds?.length ?? 0) > 0
  );
}

function isReviewable(changeSet: OntologyChangeSet): boolean {
  return REVIEWABLE_STATES.includes(changeSet.state);
}

function sourceMemoryIds(changeSet: OntologyChangeSet): string[] {
  return [
    ...new Set(
      changeSet.operations.flatMap(
        (operation) => operation.sourceMemoryIds ?? []
      )
    ),
  ];
}

function operationName(operation: OntologyChangeOperation): string {
  if (operation.operationType === OperationType.CreateGlossary) {
    return operation.glossary?.displayName || operation.glossary?.name || '';
  }

  return operation.term?.displayName || operation.term?.name || '';
}

function changeSetName(changeSet: OntologyChangeSet): string {
  return changeSet.displayName || changeSet.name;
}

// The deep-linked draft is fetched alongside the list, so it opens even when it falls outside
// the first page.
async function loadMemoryDrafts(
  initialDraftId?: string
): Promise<OntologyChangeSet[]> {
  const [linked, page] = await Promise.all([
    initialDraftId
      ? getOntologyChangeSet(initialDraftId, CHANGE_SET_FIELDS).catch(
          () => undefined
        )
      : Promise.resolve(undefined),
    listOntologyChangeSets({
      fields: CHANGE_SET_FIELDS,
      limit: PAGE_SIZE,
      memorySourced: true,
      state: REVIEWABLE_STATES,
    }),
  ]);
  const drafts = [...(linked ? [linked] : []), ...page.data];

  return drafts
    .filter(
      (changeSet, index, all) =>
        isMemoryProposal(changeSet) &&
        isReviewable(changeSet) &&
        all.findIndex((candidate) => candidate.id === changeSet.id) === index
    )
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
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
  const { t } = useTranslation();

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
                {changeSetName(changeSet)}
              </span>
              <span className="tw:text-xs tw:text-tertiary">
                {changeSet.glossaries
                  .map((glossary) => glossary.displayName || glossary.name)
                  .join(', ')}
                {' · '}
                {stateLabel(changeSet.state, t)}
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
        {operationTypeLabel(operation.operationType, t)}
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
    </li>
  );
}

// Memories the reviewer cannot open are counted rather than listed, so their names never leak.
function SourceMemoryLinks({ memoryIds }: { memoryIds: string[] }) {
  const { t } = useTranslation();
  const results = useQueries({
    queries: memoryIds.map((memoryId) => ({
      queryKey: [SOURCE_MEMORY_QUERY_KEY, memoryId],
      queryFn: () => getContextMemoryById(memoryId),
      retry: false,
      staleTime: SOURCE_MEMORY_STALE_TIME_MS,
    })),
  });
  const memories = results.flatMap((result) =>
    result.data ? [result.data] : []
  );
  const hiddenCount = results.filter((result) => result.isError).length;

  if (memoryIds.length === 0) {
    return null;
  }

  return (
    <Typography as="p" data-testid="ontology-memory-sources" size="text-sm">
      {t('label.derived-from')}:{' '}
      {memories.map((memory, index) => (
        <span key={memory.id}>
          {index > 0 ? ', ' : null}
          <Link
            className={LINK_CLASS_NAME}
            to={`${ROUTES.CONTEXT_CENTER_MEMORIES}?memory=${encodeURIComponent(
              memory.name
            )}`}>
            {memory.title || getEntityName(memory)}
          </Link>
        </span>
      ))}
      {hiddenCount > 0 ? ` +${hiddenCount}` : null}
    </Typography>
  );
}

function DraftDetail({
  changeSet,
  canApply,
  canDiscard,
  canSubmit,
  isLeaseOwned,
  isSaving,
  onAction,
}: {
  changeSet: OntologyChangeSet;
  canApply: boolean;
  canDiscard: boolean;
  canSubmit: boolean;
  isLeaseOwned: boolean;
  isSaving: boolean;
  onAction: (action: DraftAction) => void;
}) {
  const { t } = useTranslation();
  const showSubmit =
    changeSet.state === OntologyChangeSetState.Draft && canSubmit;
  const showApply =
    canApply &&
    (changeSet.state === OntologyChangeSetState.Submitted ||
      changeSet.state === OntologyChangeSetState.ApplyFailed);
  const isActionDisabled = !isLeaseOwned || isSaving;
  const applyError = changeSet.applicationResult?.results
    .map((result) => result.message)
    .filter(Boolean)
    .join('; ');

  return (
    <section className="tw:flex tw:flex-col tw:gap-4 tw:rounded-lg tw:border tw:border-secondary tw:bg-primary tw:p-5">
      <div className="tw:flex tw:items-start tw:justify-between tw:gap-4">
        <div>
          <Typography as="h2" size="text-lg" weight="semibold">
            {changeSetName(changeSet)}
          </Typography>
          <Typography as="p" className="tw:text-tertiary" size="text-sm">
            {changeSet.description}
          </Typography>
        </div>
        <span className="tw:text-sm tw:font-semibold tw:text-brand-secondary">
          {stateLabel(changeSet.state, t)}
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

      <SourceMemoryLinks memoryIds={sourceMemoryIds(changeSet)} />

      <ul className="tw:flex tw:flex-col tw:gap-3">
        {changeSet.operations.map((operation) => (
          <OperationCard key={operation.id} operation={operation} />
        ))}
      </ul>

      {applyError ? <Alert title={applyError} variant="error" /> : null}

      <div className="tw:flex tw:justify-end tw:gap-2">
        {canDiscard ? (
          <Button
            color="secondary-destructive"
            data-testid="ontology-memory-discard"
            isDisabled={isActionDisabled}
            onPress={() => onAction('discard')}>
            {t('label.discard')}
          </Button>
        ) : null}
        {showSubmit ? (
          <Button
            color="secondary"
            data-testid="ontology-memory-submit"
            isDisabled={isActionDisabled}
            isLoading={isSaving}
            onPress={() => onAction('submit')}>
            {t('label.submit')}
          </Button>
        ) : null}
        {showApply ? (
          <Button
            color="primary"
            data-testid="ontology-memory-apply"
            isDisabled={isActionDisabled}
            isLoading={isSaving}
            onPress={() => onAction('apply')}>
            {t('label.apply')}
          </Button>
        ) : null}
      </div>
    </section>
  );
}

const OntologyMemoryReviewPanel = ({
  canApply,
  canDiscard,
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
    isActive: Boolean(selected && (canSubmit || canApply || canDiscard)),
    resourceId: selected?.id,
    resourceType: 'ontologyChangeSet',
  });

  const loadChangeSets = useCallback(async () => {
    setIsLoading(true);
    try {
      const proposals = await loadMemoryDrafts(initialDraftId);
      setChangeSets(proposals);
      setSelectedId((current) =>
        proposals.some((proposal) => proposal.id === current)
          ? current
          : proposals[0]?.id
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  }, [initialDraftId]);

  useEffect(() => {
    void loadChangeSets();
  }, [loadChangeSets]);

  const runAction = (
    action: DraftAction,
    changeSetId: string,
    request: { lease: { sessionId: string; version: number } }
  ) => {
    switch (action) {
      case 'submit':
        return submitOntologyChangeSet(changeSetId, request);
      case 'discard':
        return discardOntologyChangeSet(changeSetId, request);
      default:
        return applyOntologyChangeSet(changeSetId, request);
    }
  };

  const showOutcome = (action: DraftAction, updated: OntologyChangeSet) => {
    if (updated.state === OntologyChangeSetState.ApplyFailed) {
      showErrorToast(
        updated.applicationResult?.results
          .map((result) => result.message)
          .filter(Boolean)
          .join('; ') || t('server.unexpected-error')
      );
    } else if (action === 'apply') {
      showSuccessToast(t('label.ontology-applied'));
    } else if (action === 'discard') {
      showSuccessToast(t('message.draft-discarded'));
    } else {
      showSuccessToast(
        t('server.entity-updated-success', { entity: changeSetName(updated) })
      );
    }
  };

  const handleAction = async (action: DraftAction) => {
    if (!selected || !lease.isOwned || !lease.lock) {
      return;
    }

    setIsSaving(true);
    try {
      const updated = await runAction(action, selected.id, {
        lease: { sessionId: lease.lock.sessionId, version: lease.lock.version },
      });
      const isClosed = !isReviewable(updated);
      setChangeSets((current) =>
        isClosed
          ? current.filter((changeSet) => changeSet.id !== selected.id)
          : current.map((changeSet) =>
              changeSet.id === selected.id ? updated : changeSet
            )
      );
      if (isClosed) {
        setSelectedId(undefined);
      }
      if (updated.state === OntologyChangeSetState.Applied) {
        onApplied();
      }
      showOutcome(action, updated);
    } catch (error) {
      showErrorToast(error as AxiosError);
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
                canDiscard={canDiscard}
                canSubmit={canSubmit}
                changeSet={selected}
                isLeaseOwned={lease.isOwned}
                isSaving={isSaving}
                onAction={(action) => void handleAction(action)}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default OntologyMemoryReviewPanel;
