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
  Card,
  Divider,
  Typography,
} from '@openmetadata/ui-core-components';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { VersionBump } from '../../../../generated/api/data/captureOntologyRelease';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { Stage } from '../../../../generated/type/ontologyPublicationStatus';
import {
  ONTOLOGY_WORKING_DIFF_QUERY_KEY,
  useOntologyPublication,
} from '../../../../hooks/governance/ontology/useOntologyPublication';
import { getOntologyWorkingDiff } from '../../../../rest/ontologyAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import OntologyReleaseDetails from './OntologyReleaseDetails';
import OntologyReleaseHistory from './OntologyReleaseHistory';
import {
  RELEASE_STAGE_COLORS,
  RELEASE_STAGE_LABELS,
} from './OntologyReleasePanel.constants';
import {
  deriveReleasePanelView,
  isSameWorkingState,
  nextSemanticVersion,
} from './OntologyReleasePanel.utils';
import OntologyReleaseReviewers from './OntologyReleaseReviewers';
import OntologyReleaseValidation from './OntologyReleaseValidation';
import OntologyVersionEditor from './OntologyVersionEditor';

interface OntologyReleasePanelProps {
  ontology: Ontology;
  canEdit: boolean;
  view: 'changes' | 'releases';
  onOpenTask?: (taskId: string) => void;
}

const OntologyReleasePanel = ({
  ontology,
  canEdit,
  view,
  onOpenTask,
}: OntologyReleasePanelProps) => {
  const { t } = useTranslation();
  const [editor, setEditor] = useState<{
    owner: string;
    versionBump?: VersionBump;
    releaseNotes: string;
  }>();
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [cursorRevision, setCursorRevision] = useState<string>();
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
    latestVersioned,
    history,
    current,
    currentUser,
    projection,
    canWrite,
    receipt,
    recovery,
    captureAndRequestApproval,
    capture,
    activate,
    refresh,
    retryRecovery,
    dismissActivationConflict,
    updateReviewSettings,
  } = publication;
  const scopeKey = `${ontology.id}:${currentUser?.id ?? ''}`;
  const versionBump =
    editor?.owner === scopeKey ? editor.versionBump : undefined;
  const releaseNotes = editor?.owner === scopeKey ? editor.releaseNotes : '';
  const panelView = deriveReleasePanelView(current, {
    canEdit,
    canWrite,
    userId: currentUser?.id,
    userName: currentUser?.name,
  });
  const currentStage = panelView.kind === 'ready' ? panelView.value : undefined;
  const firstPageRevision = JSON.stringify(working.data?.state);
  useEffect(() => {
    setCursors([undefined]);
    setCursorRevision(firstPageRevision);
  }, [firstPageRevision]);
  const after = cursors[cursors.length - 1];
  const page = useQuery({
    queryKey: [
      ONTOLOGY_WORKING_DIFF_QUERY_KEY,
      ontology.id,
      after,
      currentUser?.id,
    ],
    queryFn: ({ signal }) =>
      getOntologyWorkingDiff(ontology.id, { limit: 25, after }, signal),
    enabled: [
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
  const baseVersion = latestVersioned.data?.semanticVersion;
  const bump =
    versionBump ?? (baseVersion ? VersionBump.Minor : VersionBump.Major);
  const changedSinceRejection = () =>
    currentStage?.stage !== Stage.ChangesRequested ||
    currentStage.candidate.sourceWorkingRevision !==
      working.data?.state.workingRevision;
  const canCapture = [
    canWrite,
    hasCoherentPreview,
    latestVersioned.isSuccess,
    !latestVersioned.isFetching,
    Boolean(currentStage?.unpublishedChanges),
    changedSinceRejection(),
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
    if (changes.isPending || changes.isFetching || working.isFetching) {
      return <Typography role="status">{t('label.loading')}</Typography>;
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
      return <Typography role="status">{t('label.loading')}</Typography>;
    }

    return (
      release && (
        <OntologyReleaseDetails
          canPublish={canPublish}
          isActive={release.id === activeReleaseId}
          release={release}
          showExport={view !== 'releases'}
          onActivate={() =>
            activate({ kind: view === 'changes' ? 'current' : 'selected' })
          }
        />
      )
    );
  };
  const renderPublicationButtons = () => {
    if (!currentStage) {
      return null;
    }

    return (
      <Box gap={2} wrap="wrap">
        <Button
          color="secondary"
          data-testid="ontology-capture-release"
          isDisabled={!canCapture}
          onPress={() => {
            if (canCapture && changes.data) {
              void capture(changes.data.state, metadata);
            }
          }}>
          {t('label.capture-release')}
        </Button>
        {currentStage.stage === Stage.Approved ||
        currentStage.stage === Stage.InReview ? (
          <Button
            color="secondary-success"
            data-testid="ontology-publish-release"
            isDisabled={currentStage.stage !== Stage.Approved || !canWrite}
            isLoading={isBusy}
            onPress={() => void activate({ kind: 'current' })}>
            {t('label.publish')} {candidateLabel()}
          </Button>
        ) : (
          <Button
            color="primary"
            data-testid="ontology-request-review"
            isDisabled={!canCapture || !currentStage.canRequestReview}
            isLoading={isBusy}
            onPress={() => {
              if (canCapture && currentStage.canRequestReview && working.data) {
                void captureAndRequestApproval(working.data.state, metadata);
              }
            }}>
            {t(
              currentStage.stage === Stage.ChangesRequested
                ? 'label.request-review-again'
                : 'label.request-review'
            )}
          </Button>
        )}
      </Box>
    );
  };
  const renderFooter = () => {
    if (!currentStage) {
      return panelView.kind === 'loading' ? (
        <Typography role="status">{t('label.loading')}</Typography>
      ) : (
        <Alert variant="error">
          {t('message.ontology-review-unavailable')}
          <Button color="secondary" size="sm" onPress={() => void refresh()}>
            {t('label.retry')}
          </Button>
        </Alert>
      );
    }

    return (
      <Box direction="col" gap={3}>
        <Divider />
        {currentStage.stage === Stage.ChangesRequested && (
          <Alert variant="error">
            <Typography weight="semibold">
              {currentStage.rejection.actor}
            </Typography>
            <Typography
              className="tw:whitespace-pre-wrap tw:break-words"
              data-testid="ontology-rejection-reason">
              {currentStage.rejection.reason}
            </Typography>
          </Alert>
        )}
        <Box align="center" gap={3} justify="between" wrap="wrap">
          <Box align="center" gap={2} wrap="wrap">
            <Badge color={RELEASE_STAGE_COLORS[currentStage.stage]}>
              <span data-testid="ontology-release-stage">
                {t(RELEASE_STAGE_LABELS[currentStage.stage])}
              </span>
            </Badge>
            <Typography size="text-sm">{candidateLabel()}</Typography>
            {'task' in currentStage && currentStage.task && (
              <>
                {onOpenTask ? (
                  <Button
                    color="link-color"
                    size="sm"
                    onPress={() => {
                      if (currentStage.task) {
                        onOpenTask(currentStage.task.id);
                      }
                    }}>
                    {t('label.open-task')} · {currentStage.task.label}
                  </Button>
                ) : (
                  <Link to={currentStage.task.href}>
                    {currentStage.task.label}
                  </Link>
                )}
              </>
            )}
          </Box>
          {renderPublicationButtons()}
        </Box>
      </Box>
    );
  };
  const renderChanges = () => (
    <Box direction="col" gap={4}>
      <Box direction="col" gap={1}>
        <Typography as="h3" size="text-md" weight="semibold">
          {t('label.unpublished-changes')}
        </Typography>
        {working.data && (
          <Typography color="secondary" size="text-sm">
            {working.data.paging.total} {t('label.pending-changes')}
          </Typography>
        )}
      </Box>
      {renderChangeStatus()}
      {hasCoherentPreview && changes.data && (
        <ul className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-3 tw:p-0">
          {changes.data.data.map((change) => (
            <li key={change.entity.id + ':' + change.memberKind}>
              <Card size="sm">
                <Card.Content>
                  <Box gap={2} justify="between">
                    <Typography size="text-sm" weight="semibold">
                      {getEntityName(change.entity)}
                    </Typography>
                    <Badge
                      color={
                        change.changeType === 'DEPRECATED' ? 'warning' : 'gray'
                      }>
                      {t('label.' + change.changeType.toLowerCase())}
                    </Badge>
                  </Box>
                  <Typography color="secondary" size="text-xs">
                    {t(
                      'label.ontology-member-' + change.memberKind.toLowerCase()
                    )}
                  </Typography>
                </Card.Content>
              </Card>
            </li>
          ))}
        </ul>
      )}
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
            setCursors((previous) => [...previous, changes.data?.paging.after])
          }>
          {t('label.next')}
        </Button>
      </Box>
      {latestVersioned.isError && (
        <Alert variant="error">
          {t('message.ontology-version-unavailable')}
          <Button
            color="secondary"
            size="sm"
            onPress={() => void latestVersioned.refetch()}>
            {t('label.retry')}
          </Button>
        </Alert>
      )}
      {latestVersioned.isSuccess && (
        <>
          <Typography data-testid="ontology-version-preview" size="text-sm">
            {(baseVersion ?? '0.0.0') +
              ' → ' +
              nextSemanticVersion(baseVersion, bump)}
          </Typography>
          <OntologyVersionEditor
            baseVersion={baseVersion}
            bump={bump}
            isDisabled={!canWrite}
            notes={releaseNotes}
            onBumpChange={(value) =>
              setEditor({ owner: scopeKey, versionBump: value, releaseNotes })
            }
            onNotesChange={(value) =>
              setEditor({ owner: scopeKey, versionBump, releaseNotes: value })
            }
          />
        </>
      )}
    </Box>
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
  const renderValidation = () => (
    <OntologyReleaseValidation
      release={
        view === 'releases' && selectedId
          ? release
          : currentStage?.candidate ?? undefined
      }
    />
  );

  return (
    <Box direction="col" gap={4}>
      <div className="tw:grid tw:grid-cols-1 tw:gap-5 tw:md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Box direction="col" gap={4}>
          {view === 'changes' ? (
            renderChanges()
          ) : (
            <OntologyReleaseHistory
              activeReleaseId={activeReleaseId}
              history={history}
              latestReleaseId={
                projection.data?.publicationStatus?.latest?.releaseId
              }
              selectedReleaseId={selectedId}
              onSelect={setSelectedId}
            />
          )}
          {renderRelease()}
        </Box>
        <Box direction="col" gap={4}>
          <OntologyReleaseReviewers
            key={scopeKey}
            scopeKey={scopeKey}
            view={panelView}
            onChange={updateReviewSettings}
            onRefresh={refresh}
          />
          {renderValidation()}
        </Box>
      </div>
      {renderStorageStatus()}
      {renderRecovery()}
      {renderFooter()}
    </Box>
  );
};

export default OntologyReleasePanel;
