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
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  Typography,
} from '@openmetadata/ui-core-components';
import { useQuery } from '@tanstack/react-query';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AssigneeStatus } from '../../../../generated/api/data/ontologyReleaseReview';
import {
  Ontology,
  OntologyApprovalRule,
} from '../../../../generated/entity/data/ontology';
import { Stage } from '../../../../generated/type/ontologyPublicationStatus';
import {
  ONTOLOGY_WORKING_DIFF_LIMIT,
  ONTOLOGY_WORKING_DIFF_QUERY_KEY,
  useOntologyPublication,
} from '../../../../hooks/governance/ontology/useOntologyPublication';
import { reusablePublicationCandidate } from '../../../../hooks/governance/ontology/useOntologyPublication.utils';
import { useOntologyStudioModel } from '../../../../hooks/governance/ontology/useOntologyStudioModel';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import { getOntologyWorkingDiff } from '../../../../rest/ontologyAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import Loader from '../../../common/Loader/Loader';
import OntologyReleaseChangeCards from './OntologyReleaseChangeCards';
import OntologyReleaseChangeFilters from './OntologyReleaseChangeFilters';
import {
  ChangeFilter,
  countRowsByFilter,
  filterConceptChanges,
  filterMemberChanges,
  groupChangeCards,
  visibleWorkingChanges,
} from './OntologyReleaseChanges.utils';
import OntologyReleaseDetailPage from './OntologyReleaseDetailPage';
import OntologyReleaseDetails from './OntologyReleaseDetails';
import OntologyReleaseHistory from './OntologyReleaseHistory';
import {
  RELEASE_STAGE_COLORS,
  RELEASE_STAGE_LABELS,
} from './OntologyReleasePanel.constants';
import type {
  PublicationAction,
  PublicationActions,
  ReleaseTaskLink,
} from './OntologyReleasePanel.types';
import {
  deriveReleasePanelView,
  getEditorValues,
  getPublicationActions,
  getWorkingChangeCounts,
  getWorkingDraft,
  isCandidateStale,
  isSameWorkingState,
  nextSemanticVersion,
  resolveBump,
  resolveVersionChoice,
  visibleHistoryReleases,
  type VersionEditorState,
} from './OntologyReleasePanel.utils';
import OntologyReleaseReviewers from './OntologyReleaseReviewers';
import OntologyReleaseTruncationNote from './OntologyReleaseTruncationNote';
import OntologyReleaseValidation, {
  firstValidationErrors,
  firstWorkingErrors,
  useSettledValidationReport,
  useWorkingValidation,
} from './OntologyReleaseValidation';
import OntologyVersionEditor from './OntologyVersionEditor';

export interface PublicationSummary {
  fromVersion?: string;
  toVersion?: string;
  releaseCount?: number;
  hasMoreReleases?: boolean;
}

interface OntologyReleasePanelProps {
  ontology: Ontology;
  canEdit: boolean;
  view: 'changes' | 'releases';
  onOpenTask?: (taskId: string) => void;
  /** Reports the version step and release count the dialog header shows. */
  onSummaryChange?: (summary: PublicationSummary) => void;
}

const hasMorePages = (
  isCoherent: boolean,
  pagesSeen: number,
  after: string | undefined
) => isCoherent && (pagesSeen > 1 || Boolean(after));

const loadedPages = <T,>(pages?: { data: T[] }[]) =>
  (pages ?? []).flatMap((entry) => entry.data);

const versionTag = (version: string) =>
  /^\d/.test(version) ? 'v' + version : version;

const isSameUser = (left?: string, right?: string) =>
  Boolean(right) && left === right;

// A decided release keeps its own version; otherwise a reused Draft's, then the next.
const displayedVersion = (
  reusable: string | undefined,
  decided: string | undefined,
  next: () => string
) => reusable ?? decided ?? next();

const namesWithStatus = (
  assignees: {
    assignee: Parameters<typeof getEntityName>[0];
    status: AssigneeStatus;
  }[],
  statuses: AssigneeStatus[]
) =>
  assignees
    .filter((entry) => statuses.includes(entry.status))
    .map((entry) => getEntityName(entry.assignee))
    .join(', ');

const countWithStatus = (
  assignees: { status: AssigneeStatus }[],
  status: AssigneeStatus
) => assignees.filter((entry) => entry.status === status).length;

/**
 * The names the footer sentence is about: who approved once approved, who is
 * still pending while the review is open, else the configured reviewers.
 */
const reviewersLine = (
  assignees: Parameters<typeof namesWithStatus>[0],
  state: PublicationActions['state'],
  configured: Parameters<typeof getEntityName>[0][]
) => {
  const order =
    state === 'approvedCanPublish'
      ? [
          [AssigneeStatus.Approved],
          [AssigneeStatus.Pending, AssigneeStatus.Approved],
        ]
      : [
          [AssigneeStatus.Pending],
          [AssigneeStatus.Approved, AssigneeStatus.Pending],
        ];

  return (
    order
      .map((statuses) => namesWithStatus(assignees, statuses))
      .find(Boolean) || configured.map(getEntityName).join(', ')
  );
};

/** Tells the dialog header which version step and how many releases to show. */
const usePublicationSummary = (
  onSummaryChange: OntologyReleasePanelProps['onSummaryChange'],
  {
    baseVersion,
    hasVersion,
    bump,
    history,
    latestReleaseId,
  }: {
    baseVersion?: string;
    hasVersion: boolean;
    bump: Parameters<typeof nextSemanticVersion>[1];
    history: ReturnType<typeof useOntologyPublication>['history'];
    latestReleaseId?: string;
  }
) => {
  const fromVersion =
    hasVersion && baseVersion ? versionTag(baseVersion) : undefined;
  const toVersion = hasVersion
    ? versionTag(nextSemanticVersion(baseVersion, bump))
    : undefined;
  const releaseCount = history.isSuccess
    ? visibleHistoryReleases(
        history.data.pages.flatMap((entry) => entry.data),
        latestReleaseId
      ).length
    : undefined;
  const hasMoreReleases = history.hasNextPage;
  useEffect(() => {
    onSummaryChange?.({
      fromVersion,
      toVersion,
      releaseCount,
      hasMoreReleases,
    });
  }, [fromVersion, toVersion, releaseCount, hasMoreReleases, onSummaryChange]);
};

const OntologyReleasePanel = ({
  ontology,
  canEdit,
  view,
  onOpenTask,
  onSummaryChange,
}: OntologyReleasePanelProps) => {
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();
  // Shared with the graph through the query cache; only used to name concepts in validation messages.
  const { model: conceptModel } = useOntologyStudioModel(ontology);
  const validationConcepts = useMemo(
    () =>
      (conceptModel?.concepts ?? []).map((concept) => ({
        name: concept.name,
        iri: concept.iri,
        label: getEntityName(concept),
      })),
    [conceptModel?.concepts]
  );
  const [editor, setEditor] = useState<VersionEditorState>();
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [cursorRevision, setCursorRevision] = useState<string>();
  const [changeFilter, setChangeFilter] = useState<ChangeFilter>('all');
  const [changeSearch, setChangeSearch] = useState('');
  // History loads only when Releases is open, as before, so the header shows
  // the release count once that tab has loaded it.
  const publication = useOntologyPublication(
    ontology.id,
    canEdit,
    view === 'releases'
  );
  const {
    state,
    activeReleaseId,
    working,
    candidate,
    selected,
    selectedId,
    setSelectedId,
    isBusy,
    versionBase,
    history,
    current,
    currentUser,
    projection,
    canWrite,
    receipt,
    recovery,
    captureAndRequestApproval,
    capture,
    publishDirectly,
    withdraw,
    notice,
    dismissNotice,
    activate,
    refresh,
    retryRecovery,
    dismissActivationConflict,
    updateReviewSettings,
  } = publication;
  const userId = currentUser?.id;
  const scopeKey = `${ontology.id}:${userId ?? ''}`;
  const { versionBump, releaseNotes } = getEditorValues(editor, scopeKey);
  const panelView = deriveReleasePanelView(current, {
    canEdit,
    canWrite,
    userId,
    userName: currentUser?.name,
  });
  const currentStage = panelView.kind === 'ready' ? panelView.value : undefined;
  const validationReport = useSettledValidationReport(currentStage?.candidate);
  const workingRevision = working.data?.state.workingRevision;
  const workingDraft = getWorkingDraft(
    ontology.id,
    workingRevision,
    view === 'changes' &&
      isCandidateStale(currentStage?.candidate, workingRevision)
  );
  const workingValidation = useWorkingValidation(workingDraft);
  const workingErrors = firstWorkingErrors(
    workingValidation.isSuccess ? workingValidation.data : undefined
  );
  const firstPageRevision = JSON.stringify(working.data?.state);
  useEffect(() => {
    setCursors([undefined]);
    setCursorRevision(firstPageRevision);
  }, [firstPageRevision]);
  const after = cursors[cursors.length - 1];
  const page = useQuery({
    queryKey: [ONTOLOGY_WORKING_DIFF_QUERY_KEY, ontology.id, after, userId],
    queryFn: ({ signal }) =>
      getOntologyWorkingDiff(
        ontology.id,
        { limit: ONTOLOGY_WORKING_DIFF_LIMIT, after, groupBy: 'concept' },
        signal
      ),
    enabled: [
      canEdit,
      view === 'changes',
      cursors.length > 1,
      cursorRevision === firstPageRevision,
    ].every(Boolean),
    gcTime: 0,
    retry: false,
  });
  const changes = cursors.length === 1 ? working : page;
  const hasCoherentPreview = [
    [working, changes].every(
      (result) => result.isSuccess && !result.isFetching
    ),
    cursorRevision === firstPageRevision,
    isSameWorkingState(working.data?.state, changes.data?.state),
  ].every(Boolean);
  const displayed = view === 'changes' ? candidate : selected;
  const release = displayed.data;
  const canPublish = [
    canWrite,
    state.isSuccess,
    !state.isFetching,
    displayed.isSuccess,
    !displayed.isFetching,
  ].every(Boolean);
  const baseVersion = versionBase.data?.semanticVersion;
  const { suggestion, isPickRequired: isVersionPickRequired } =
    resolveVersionChoice(working.data, baseVersion, versionBump);
  const isFirstRelease = versionBase.isSuccess && !baseVersion;
  const visible = visibleWorkingChanges(changes.data, isFirstRelease);
  const changeCounts = getWorkingChangeCounts(
    working.data,
    currentStage?.unpublishedChanges,
    isFirstRelease
  );
  // After a publish the draft is empty: say so instead of an empty list with paging.
  const hasNoChanges = Boolean(working.data) && changeCounts.total === 0;
  const bump = resolveBump(versionBump, suggestion);
  const getNextVersion = () =>
    versionBase.isSuccess ? nextSemanticVersion(baseVersion, bump) : '';
  usePublicationSummary(onSummaryChange, {
    baseVersion,
    hasVersion: versionBase.isSuccess,
    bump,
    history,
    latestReleaseId: projection.data?.publicationStatus?.latest?.releaseId,
  });
  const changedSinceRejection = () =>
    currentStage?.stage !== Stage.ChangesRequested ||
    currentStage.candidate.sourceWorkingRevision !==
      working.data?.state.workingRevision;
  const canCapture = [
    canWrite,
    hasCoherentPreview,
    versionBase.isSuccess,
    !versionBase.isFetching,
    Boolean(currentStage?.unpublishedChanges),
    changedSinceRejection(),
    !isVersionPickRequired,
  ].every(Boolean);
  const metadata = { versionBump: bump, releaseNotes };
  const retryChanges = () => {
    setCursors([undefined]);
    void refresh();
  };
  const candidateLabel = () => {
    if (!currentStage?.candidate) {
      return undefined;
    }

    return (
      currentStage.candidate.semanticVersion ??
      t('label.ontology-release-revision', {
        revision: currentStage.candidate.releaseRevision,
      })
    );
  };
  const renderChangeStatus = () => {
    if (!canEdit) {
      return null;
    }
    if (changes.isPending || changes.isFetching || working.isFetching) {
      return <Loader size="small" />;
    }
    if (changes.isError || !hasCoherentPreview) {
      return (
        <Alert variant={changes.isError ? 'error' : 'warning'}>
          {t('message.ontology-review-unavailable')}
          <Button color="secondary" size="sm" onPress={retryChanges}>
            {t('label.retry')}
          </Button>
        </Alert>
      );
    }
    if (hasNoChanges) {
      return (
        <Typography
          color="secondary"
          data-testid="ontology-working-empty"
          size="text-sm">
          {t('message.ontology-no-unpublished-changes')}
        </Typography>
      );
    }

    return null;
  };
  const renderRelease = () => {
    if (
      !(view === 'changes'
        ? projection.data?.publicationStatus?.latest?.releaseId
        : selectedId)
    ) {
      return null;
    }
    if (displayed.isError) {
      return (
        <Alert variant="error">
          {t('message.ontology-review-unavailable')}
        </Alert>
      );
    }
    if (displayed.isPending) {
      return <Loader size="small" />;
    }

    return (
      release && (
        <OntologyReleaseDetails
          activeRelease={versionBase.data}
          canPublish={canPublish}
          isActive={release.id === activeReleaseId}
          ontologyName={getEntityName(ontology)}
          release={release}
          showExport={view !== 'releases'}
          onActivate={() =>
            activate({ kind: view === 'changes' ? 'current' : 'selected' })
          }
        />
      )
    );
  };
  const getActionInput = () => {
    if (
      !currentStage ||
      current.kind !== 'ready' ||
      panelView.kind !== 'ready'
    ) {
      return undefined;
    }
    const reusable = reusablePublicationCandidate(current.value);
    const isDecided = [Stage.Approved, Stage.InReview].includes(
      currentStage.stage
    );
    const version = displayedVersion(
      reusable?.semanticVersion,
      isDecided ? currentStage.candidate?.semanticVersion : undefined,
      getNextVersion
    );

    return {
      stage: currentStage.stage,
      canEdit,
      hasReviewers: panelView.value.settings.reviewers.length > 0,
      hasIndependentReviewer: panelView.value.hasIndependentReviewer,
      hasChanges: currentStage.unpublishedChanges > 0,
      changedSinceRejection: changedSinceRejection(),
      validationErrors: workingErrors.length
        ? workingErrors
        : firstValidationErrors(validationReport),
      isReady: isDecided ? canWrite : canCapture,
      isRequester: isSameUser(current.value.review?.requester?.id, userId),
      version,
    };
  };
  const requestReview = () => {
    if (working.data) {
      void captureAndRequestApproval(working.data.state, metadata);
    }
  };
  const publish = () => {
    if (currentStage?.stage === Stage.Approved) {
      void activate({ kind: 'current' });
    } else if (working.data) {
      void publishDirectly(working.data.state, metadata);
    }
  };
  const actionHandlers: Record<PublicationAction['kind'], () => void> = {
    saveDraft: () => {
      if (changes.data) {
        void capture(changes.data.state, metadata);
      }
    },
    requestReview,
    requestReviewAgain: requestReview,
    withdraw: () => void withdraw(),
    publish,
  };
  const runAction = (action: PublicationAction) => {
    if (!action.isDisabled) {
      actionHandlers[action.kind]();
    }
  };
  const ACTION_TEST_IDS = {
    publish: 'ontology-publish-release',
    requestReview: 'ontology-request-review',
    requestReviewAgain: 'ontology-request-review',
    saveDraft: 'ontology-capture-release',
    withdraw: 'ontology-withdraw-request',
  } as const;
  const actionLabel = (action: PublicationAction, version: string) => {
    switch (action.kind) {
      case 'publish':
        return version
          ? t('label.publish') + ' ' + versionTag(version)
          : t('label.publish');
      case 'requestReview':
        return t('label.request-review');
      case 'requestReviewAgain':
        return t('label.request-review-again');
      case 'saveDraft':
        return t('label.save-as-release-draft');
      case 'withdraw':
        return t('label.withdraw-request');
    }
  };
  const renderActionButton = (
    action: PublicationAction,
    version: string,
    color: 'primary' | 'secondary'
  ) => (
    <Button
      color={color}
      data-testid={ACTION_TEST_IDS[action.kind]}
      isDisabled={action.isDisabled}
      isLoading={isBusy && color === 'primary'}
      onPress={() => runAction(action)}>
      {actionLabel(action, version)}
    </Button>
  );
  const renderActionText = (actions: PublicationActions) => {
    const ready = panelView.kind === 'ready' ? panelView.value : undefined;
    const assignees = ready?.assignees ?? [];
    const reviewers = reviewersLine(
      assignees,
      actions.state,
      ready?.settings.reviewers ?? []
    );
    const progress =
      actions.state === 'inReview' &&
      ready?.settings.approvalRule === OntologyApprovalRule.AllReviewers
        ? ' ' +
          t('message.ontology-publication-review-progress', {
            approved: countWithStatus(assignees, AssigneeStatus.Approved),
            total: assignees.length,
          })
        : null;

    return (
      <Typography
        className="tw:text-tertiary"
        data-testid="ontology-publication-text"
        role="note"
        size="text-sm">
        {t(actions.text, { reviewers })}
        {progress}
      </Typography>
    );
  };
  const renderActionErrors = (actions: PublicationActions) =>
    actions.errors.length > 0 && (
      <ul
        className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:items-end tw:gap-1 tw:p-0"
        data-testid="ontology-publication-errors">
        {actions.errors.map((message) => (
          <li key={message}>
            <Typography color="danger" size="text-sm">
              {message}
            </Typography>
          </li>
        ))}
      </ul>
    );
  const renderNotice = () => {
    if (!notice) {
      return null;
    }
    const ontologyName = getEntityName(ontology);
    let action: ReactNode = null;
    let title: string;
    let detail: ReactNode = null;
    switch (notice.kind) {
      case 'requested':
        title = t('message.ontology-publication-sent', {
          version: notice.version,
          reviewers: notice.reviewers.join(', '),
        });
        detail = (
          <Typography size="text-sm">
            {t('message.ontology-publication-notify-on-decision')}
          </Typography>
        );
        action = onOpenTask ? (
          <Button
            color="secondary"
            data-testid="ontology-view-request"
            size="sm"
            onPress={() => onOpenTask(notice.taskId)}>
            {t('label.view-request')}
          </Button>
        ) : (
          <Link data-testid="ontology-view-request" to={notice.taskHref}>
            {t('label.view-request')}
          </Link>
        );

        break;
      case 'published':
        title = t('message.ontology-publication-published', {
          version: notice.version,
          ontology: ontologyName,
        });

        break;
      case 'withdrawn':
        title = t('message.ontology-publication-withdrawn', {
          version: notice.version,
        });

        break;
      case 'unchanged':
        title = t('message.ontology-publication-unchanged', {
          version: notice.version,
        });
        detail = notice.releaseNotes ? (
          <Typography
            className="tw:whitespace-pre-wrap tw:break-words"
            data-testid="ontology-publication-unchanged-notes"
            size="text-sm">
            {t('message.ontology-publication-unchanged-notes', {
              notes: notice.releaseNotes,
            })}
          </Typography>
        ) : null;

        break;
    }

    return (
      <Alert
        closable
        data-testid={'ontology-publication-notice-' + notice.kind}
        variant={notice.kind === 'unchanged' ? 'warning' : 'success'}
        onClose={dismissNotice}>
        <Typography weight="semibold">{title}</Typography>
        {detail}
        {action}
      </Alert>
    );
  };
  const renderPublicationButtons = (
    actions: PublicationActions,
    version: string
  ) => (
    <Box align="center" gap={3} wrap="wrap">
      {renderActionErrors(actions)}
      {actions.secondary &&
        renderActionButton(actions.secondary, version, 'secondary')}
      {actions.primary &&
        renderActionButton(
          actions.primary,
          version,
          actions.primary.isDisabled ? 'secondary' : 'primary'
        )}
    </Box>
  );
  const renderStageStatus = () =>
    panelView.kind === 'loading' ? (
      <Loader size="small" />
    ) : (
      <Alert variant="error">
        {t('message.ontology-review-unavailable')}
        <Button color="secondary" size="sm" onPress={() => void refresh()}>
          {t('label.retry')}
        </Button>
      </Alert>
    );
  const renderTaskLink = (task: ReleaseTaskLink) =>
    onOpenTask ? (
      <Button color="link-color" size="sm" onPress={() => onOpenTask(task.id)}>
        {t('label.open-task')} · {task.label}
      </Button>
    ) : (
      <Link to={task.href}>{task.label}</Link>
    );
  const renderStageLine = (
    stage: NonNullable<typeof currentStage>,
    actions: PublicationActions | undefined
  ) => (
    <Box align="center" className="tw:gap-x-2 tw:gap-y-1" wrap="wrap">
      {baseVersion ? (
        <Badge color="success" size="sm" type="pill-color">
          {t('label.published-version', { version: versionTag(baseVersion) })}
        </Badge>
      ) : null}
      <Badge color={RELEASE_STAGE_COLORS[stage.stage]} size="sm">
        <span data-testid="ontology-release-stage">
          {t(RELEASE_STAGE_LABELS[stage.stage])}
        </span>
      </Badge>
      {candidateLabel() ? (
        <Typography size="text-sm">{candidateLabel()}</Typography>
      ) : null}
      {'task' in stage && stage.task ? renderTaskLink(stage.task) : null}
      {actions ? renderActionText(actions) : null}
    </Box>
  );
  const renderRejection = (stage: NonNullable<typeof currentStage>) =>
    stage.stage === Stage.ChangesRequested && (
      <Alert variant="error">
        <Typography weight="semibold">{stage.rejection.actor}</Typography>
        <Typography
          className="tw:whitespace-pre-wrap tw:break-words"
          data-testid="ontology-rejection-reason">
          {stage.rejection.reason}
        </Typography>
      </Alert>
    );
  const renderFooter = (preview?: ReactNode) => {
    if (!currentStage) {
      return renderStageStatus();
    }
    const input = getActionInput();
    const actions = input ? getPublicationActions(input) : undefined;

    return (
      <Box direction="col" gap={3}>
        {preview ? null : <Divider />}
        {renderNotice()}
        {renderRejection(currentStage)}
        <Box align="center" gap={4} justify="between" wrap="wrap">
          <Box className="tw:min-w-0 tw:flex-1 tw:gap-0.5" direction="col">
            {preview}
            {renderStageLine(currentStage, actions)}
          </Box>
          {input && actions
            ? renderPublicationButtons(actions, input.version)
            : null}
        </Box>
      </Box>
    );
  };
  const getBaseVersionTag = () =>
    baseVersion ? versionTag(baseVersion) : t('label.draft');
  const getVersionPreview = () =>
    versionBase.isSuccess
      ? getBaseVersionTag() +
        ' → ' +
        versionTag(nextSemanticVersion(baseVersion, bump))
      : t('label.loading');

  const renderAiFooter = () => {
    const preview = (
      <Typography color="secondary" size="text-sm">
        <span data-testid="ontology-version-preview">
          {getVersionPreview()}
        </span>
        {working.data
          ? ' · ' +
            t('message.ontology-change-total', {
              count: changeCounts.total,
            })
          : null}
      </Typography>
    );

    return (
      <Box
        className="tw:sticky tw:bottom-0 tw:z-10 tw:-mx-6 tw:mt-auto tw:border-t tw:border-secondary tw:bg-overlay-surface tw:px-6 tw:py-4"
        direction="col"
        gap={3}>
        {currentStage ? renderFooter(preview) : preview}
      </Box>
    );
  };

  const renderChangesHeading = () =>
    working.data && (
      <OntologyReleaseChangeFilters
        counts={changeCounts}
        filter={changeFilter}
        rowCounts={countRowsByFilter(
          visible.groups,
          visible.members,
          changeSearch
        )}
        search={changeSearch}
        onFilterChange={setChangeFilter}
        onSearchChange={setChangeSearch}
      />
    );

  // Paging belongs to a loaded list that has more than one page.
  const hasChangePages = hasMorePages(
    hasCoherentPreview,
    cursors.length,
    changes.data?.paging.after
  );
  const renderChangesPagination = () =>
    hasNoChanges ? null : (
      <>
        <OntologyReleaseTruncationNote working={working.data} />
        {hasChangePages ? (
          <Box gap={2}>
            <Button
              color="secondary"
              data-testid="ontology-working-previous"
              isDisabled={cursors.length === 1 || !hasCoherentPreview}
              size="sm"
              onPress={() => setCursors((previous) => previous.slice(0, -1))}>
              {t('label.previous')}
            </Button>
            <Button
              color="secondary"
              data-testid="ontology-working-next"
              isDisabled={!changes.data?.paging.after || !hasCoherentPreview}
              size="sm"
              onPress={() =>
                setCursors((previous) => [
                  ...previous,
                  changes.data?.paging.after,
                ])
              }>
              {t('label.next')}
            </Button>
          </Box>
        ) : null}
      </>
    );

  const renderVersionError = () =>
    versionBase.isError && (
      <Alert variant="error">
        {t('message.ontology-version-unavailable')}
        <Button
          color="secondary"
          size="sm"
          onPress={() => void versionBase.refetch()}>
          {t('label.retry')}
        </Button>
      </Alert>
    );

  const renderReviewers = () => (
    <OntologyReleaseReviewers
      key={scopeKey}
      scopeKey={scopeKey}
      view={panelView}
      onChange={updateReviewSettings}
      onRefresh={refresh}
    />
  );

  const renderVersionEditor = (beforeNotes: ReactNode) =>
    versionBase.isSuccess && (
      <OntologyVersionEditor
        baseVersion={baseVersion}
        beforeNotes={beforeNotes}
        bump={isVersionPickRequired ? undefined : bump}
        isDisabled={!canWrite}
        isPickRequired={isVersionPickRequired}
        notes={releaseNotes}
        suggestion={suggestion}
        onBumpChange={(value) =>
          setEditor({ owner: scopeKey, versionBump: value, releaseNotes })
        }
        onNotesChange={(value) =>
          setEditor({ owner: scopeKey, versionBump, releaseNotes: value })
        }
      />
    );

  const renderValidation = () => (
    <OntologyReleaseValidation
      concepts={validationConcepts}
      release={
        view === 'releases' && selectedId
          ? release
          : currentStage?.candidate ?? undefined
      }
      working={workingDraft}
    />
  );

  const renderAiChanges = () => (
    <Box direction="col" gap={5}>
      <div className="tw:grid tw:grid-cols-1 tw:gap-6 tw:lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <Box className="tw:min-w-0" direction="col" gap={4}>
          {renderChangesHeading()}
          {renderChangeStatus()}
          {hasCoherentPreview && changes.data && (
            <OntologyReleaseChangeCards
              cards={groupChangeCards(
                filterConceptChanges(
                  visible.groups,
                  changeFilter,
                  changeSearch
                ),
                filterMemberChanges(visible.members, changeFilter, changeSearch)
              )}
            />
          )}
          {renderChangesPagination()}
          {renderVersionError()}
        </Box>
        <Box className="tw:min-w-0" direction="col" gap={4}>
          {renderValidation()}
          {renderVersionEditor(renderReviewers())}
          {versionBase.isSuccess ? null : renderReviewers()}
        </Box>
      </div>
    </Box>
  );

  // Only the requester of the open review may withdraw it, as the footer allows.
  const withdrawableReleaseId = (() => {
    const input = getActionInput();
    const actions = input ? getPublicationActions(input) : undefined;
    const canWithdraw =
      actions?.secondary?.kind === 'withdraw' && !actions.secondary.isDisabled;

    return canWithdraw ? currentStage?.candidate?.id : undefined;
  })();
  const loadedReleases = loadedPages(history.data?.pages);
  const latestReleaseId = projection.data?.publicationStatus?.latest?.releaseId;

  const renderReleaseDetail = () => {
    if (displayed.isError) {
      return (
        <Alert variant="error">
          {t('message.ontology-review-unavailable')}
        </Alert>
      );
    }
    if (!release) {
      return <Loader size="small" />;
    }

    return (
      <OntologyReleaseDetailPage
        activeRelease={versionBase.data}
        canPublish={canPublish}
        canWithdraw={release.id === withdrawableReleaseId}
        latestReleaseId={latestReleaseId}
        ontologyName={getEntityName(ontology)}
        release={release}
        releases={loadedReleases}
        onActivate={() => activate({ kind: 'selected' })}
        onBack={() => setSelectedId(undefined)}
        onOpenTask={onOpenTask}
        onWithdraw={() => void withdraw()}
      />
    );
  };

  const renderReleases = () =>
    isAiMode && selectedId ? (
      renderReleaseDetail()
    ) : (
      <OntologyReleaseHistory
        activeRelease={versionBase.data}
        activeReleaseId={activeReleaseId}
        history={history}
        latestReleaseId={latestReleaseId}
        ontologyId={ontology.id}
        selectedReleaseId={selectedId}
        withdrawableReleaseId={withdrawableReleaseId}
        onOpenTask={onOpenTask}
        onSelect={setSelectedId}
        onWithdraw={() => void withdraw()}
      />
    );

  const renderStorageStatus = () =>
    receipt.kind === 'unavailable' && (
      <Alert variant="error">
        {t('message.ontology-publication-storage-unavailable')}
        <Button
          color="secondary"
          size="sm"
          onPress={() => void retryRecovery()}>
          {t('label.retry')}
        </Button>
      </Alert>
    );
  const recoveryVersion = () => {
    if (!recovery) {
      return undefined;
    }
    if (recovery.operation === 'capture') {
      return recovery.expectedVersion;
    }

    return (
      recovery.release.semanticVersion ??
      t('label.ontology-release-revision', {
        revision: recovery.release.releaseRevision,
      })
    );
  };
  const renderRecovery = () => {
    if (!recovery) {
      return null;
    }
    const conflict =
      recovery.operation === 'activation' && recovery.phase === 'conflict';
    const retryReview =
      recovery.operation === 'review' && recovery.phase === 'failed';
    let actionLabel = retryReview ? 'label.retry-review' : 'label.check-status';
    if (conflict) {
      actionLabel = 'label.review-current-release';
    }

    return (
      <Alert variant="warning">
        <Typography>
          {t(
            conflict
              ? 'message.ontology-activation-conflict'
              : 'message.ontology-publication-recovery',
            { version: recoveryVersion() }
          )}
        </Typography>
        <Button
          color="secondary"
          data-testid="ontology-recovery-action"
          isDisabled={isBusy || (retryReview && !canEdit)}
          size="sm"
          onPress={() =>
            void (conflict ? dismissActivationConflict() : retryRecovery())
          }>
          {t(actionLabel)}
        </Button>
      </Alert>
    );
  };

  const renderStateError = () =>
    state.isError && (
      <Alert variant="error">
        {t('message.ontology-review-unavailable')}
        <Button
          color="secondary"
          size="sm"
          onPress={() => void state.refetch()}>
          {t('label.retry')}
        </Button>
      </Alert>
    );

  // The AI Releases tab has no stage footer; its rows and detail carry the status.
  const renderReleasesFooter = () => {
    if (isAiMode) {
      return renderNotice();
    }

    return currentStage ? (
      <div className="tw:mt-auto">{renderFooter()}</div>
    ) : null;
  };

  const renderAiPanel = () => {
    const isChanges = view === 'changes';

    return (
      <Box
        className={isChanges ? 'tw:flex-1' : 'tw:flex-1 tw:pb-5'}
        direction="col"
        gap={4}>
        {renderStateError()}
        {isChanges ? renderAiChanges() : renderReleases()}
        {isAiMode ? null : renderRelease()}
        {renderStorageStatus()}
        {renderRecovery()}
        {currentStage || state.isError ? null : renderStageStatus()}
        {isChanges ? renderAiFooter() : renderReleasesFooter()}
      </Box>
    );
  };

  return renderAiPanel();
};

export default OntologyReleasePanel;
