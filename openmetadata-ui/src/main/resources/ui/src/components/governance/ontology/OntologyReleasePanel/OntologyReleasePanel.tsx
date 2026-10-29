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
  Typography,
} from '@openmetadata/ui-core-components';
import { ChevronDown } from '@openmetadata/ui-core-components/icons';
import { useQuery } from '@tanstack/react-query';
import { groupBy } from 'lodash';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { VersionBump } from '../../../../generated/api/data/captureOntologyRelease';
import {
  ChangeType,
  MemberChange,
} from '../../../../generated/api/data/ontologyWorkingDiff';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { useOntologyPublication } from '../../../../hooks/governance/ontology/useOntologyPublication';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import { getOntologyWorkingDiff } from '../../../../rest/ontologyAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import OntologyReleaseDetails from './OntologyReleaseDetails';
import OntologyReleaseHistory from './OntologyReleaseHistory';
import {
  isSameWorkingState,
  nextSemanticVersion,
} from './OntologyReleasePanel.utils';
import OntologyReleaseValidation from './OntologyReleaseValidation';
import OntologyVersionEditor from './OntologyVersionEditor';

const CHANGE_BADGE_COLOR = {
  [ChangeType.Added]: 'success',
  [ChangeType.Changed]: 'warning',
  [ChangeType.Deprecated]: 'gray',
  [ChangeType.Removed]: 'error',
} as const;

const AiChangeGroups = ({ changes }: { changes: MemberChange[] }) => {
  const { t } = useTranslation();

  return (
    <Box data-testid="ontology-change-groups" direction="col" gap={3}>
      {Object.entries(groupBy(changes, 'memberKind')).map(([kind, rows]) => (
        <details
          open
          className="tw:group tw:overflow-hidden tw:rounded-xl tw:border tw:border-secondary"
          key={kind}>
          <summary className="tw:flex tw:cursor-pointer tw:list-none tw:items-center tw:gap-2 tw:bg-secondary_alt tw:px-4 tw:py-3">
            <ChevronDown
              aria-hidden="true"
              className="tw:size-4 tw:shrink-0 tw:-rotate-90 tw:group-open:rotate-0"
            />
            <Typography
              as="span"
              className="tw:flex-1"
              size="text-sm"
              weight="semibold">
              {t('label.ontology-member-' + kind.toLowerCase())}
            </Typography>
            <Badge color="gray" size="sm" type="pill-color">
              {rows.length}
            </Badge>
          </summary>
          <ul className="tw:m-0 tw:list-none tw:p-0">
            {rows.map((change) => (
              <li
                className="tw:flex tw:items-center tw:gap-3 tw:border-t tw:border-secondary tw:px-4 tw:py-3"
                key={change.entity.id + ':' + change.memberKind}>
                <Typography
                  as="span"
                  className="tw:min-w-0 tw:flex-1 tw:truncate"
                  size="text-sm">
                  {getEntityName(change.entity)}
                </Typography>
                <Badge
                  color={CHANGE_BADGE_COLOR[change.changeType]}
                  size="sm"
                  type="pill-color">
                  {t('label.' + change.changeType.toLowerCase())}
                </Badge>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </Box>
  );
};

interface OntologyReleasePanelProps {
  ontology: Ontology;
  canEdit: boolean;
  view: 'changes' | 'releases';
}

const OntologyReleasePanel = ({
  ontology,
  canEdit,
  view,
}: OntologyReleasePanelProps) => {
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();
  const [versionBump, setVersionBump] = useState<VersionBump>();
  const [releaseNotes, setReleaseNotes] = useState('');
  const [reviewBaseVersion, setReviewBaseVersion] = useState<string>();
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [cursorRevision, setCursorRevision] = useState<string>();
  const {
    state,
    activeReleaseId,
    working,
    selected,
    selectedId,
    releaseId,
    release,
    setSelectedId,
    isBusy,
    latestVersioned,
    history,
    pendingReview,
    captureAndRequestApproval,
    capture,
    requestApproval,
    activate,
  } = useOntologyPublication(ontology.id, canEdit, view === 'releases');
  const firstPageRevision = working.data
    ? `${working.data.state.workingRevision}:${working.data.state.activationRevision}:${working.data.state.lastReleaseRevision}`
    : undefined;
  useEffect(() => {
    setCursors([undefined]);
    setCursorRevision(firstPageRevision);
  }, [firstPageRevision]);
  const after = cursors[cursors.length - 1];
  const page = useQuery({
    queryKey: ['ontology-working-diff', ontology.id, after],
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
  const previewPagesReady = [working, changes].every(
    (result) => result.isSuccess && !result.isFetching
  );
  const hasCoherentPreview =
    previewPagesReady &&
    cursorRevision === firstPageRevision &&
    isSameWorkingState(working.data?.state, changes.data?.state);
  const canPublish = [
    canEdit,
    !isBusy,
    state.isSuccess,
    !state.isFetching,
  ].every(Boolean);
  const baseVersion = latestVersioned.data?.semanticVersion;
  const bump =
    versionBump ?? (baseVersion ? VersionBump.Minor : VersionBump.Major);
  const canCapture = [
    canEdit,
    !isBusy,
    hasCoherentPreview,
    latestVersioned.isSuccess,
    !latestVersioned.isFetching,
    !pendingReview,
  ].every(Boolean);
  const metadata = { versionBump: bump, releaseNotes };
  const canRetryReview = [
    canEdit,
    !isBusy,
    hasCoherentPreview,
    Boolean(pendingReview),
  ].every(Boolean);
  const previewBaseVersion = pendingReview ? reviewBaseVersion : baseVersion;
  const editorIsDisabled = [!canEdit, isBusy, Boolean(pendingReview)].some(
    Boolean
  );
  const retryChanges = () => {
    setCursors([undefined]);
    void working.refetch();
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
    if (!selectedId) {
      return null;
    }
    if (selected.isError) {
      return (
        <Alert variant="error">
          {t('message.ontology-review-unavailable')}
        </Alert>
      );
    }
    if (releaseId && selected.isPending) {
      return <Typography role="status">{t('label.loading')}</Typography>;
    }

    return (
      release && (
        <OntologyReleaseDetails
          canPublish={canPublish}
          isActive={release.id === activeReleaseId}
          release={release}
          showExport={view !== 'releases'}
          onActivate={activate}
          onRequestApproval={requestApproval}
        />
      )
    );
  };

  const getVersionPreview = () =>
    latestVersioned.isSuccess
      ? (previewBaseVersion ?? '0.0.0') +
        ' → ' +
        (pendingReview?.semanticVersion ??
          nextSemanticVersion(previewBaseVersion, bump))
      : t('label.loading');

  const renderPublishButtons = () => (
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
      <Button
        color="primary"
        data-testid="ontology-request-review"
        isDisabled={pendingReview ? !canRetryReview : !canCapture}
        isLoading={isBusy}
        onPress={() => {
          if ((canCapture || canRetryReview) && working.data) {
            if (!pendingReview) {
              setReviewBaseVersion(baseVersion);
              setVersionBump(bump);
            }
            void captureAndRequestApproval(working.data.state, metadata);
          }
        }}>
        {t(pendingReview ? 'label.retry-review' : 'label.request-review')}
      </Button>
    </Box>
  );

  const renderFooter = () => (
    <Box
      align="center"
      className="tw:border-t tw:border-secondary tw:pt-4"
      gap={3}
      justify="between"
      wrap="wrap">
      <Typography data-testid="ontology-version-preview" size="text-sm">
        {getVersionPreview()}
      </Typography>
      {renderPublishButtons()}
    </Box>
  );

  const renderAiFooter = () => (
    <div className="tw:sticky tw:bottom-0 tw:z-10 tw:-mx-6 tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3 tw:border-t tw:border-secondary tw:bg-overlay-surface tw:px-6 tw:py-4">
      <Typography color="secondary" size="text-sm">
        <span data-testid="ontology-version-preview">
          {getVersionPreview()}
        </span>
        {working.data
          ? ` · ${working.data.paging.total} ${t('label.pending-changes')}`
          : null}
      </Typography>
      {renderPublishButtons()}
    </div>
  );

  const renderChangesHeading = () => (
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
  );

  const renderChangesPagination = () => (
    <Box gap={2}>
      <Button
        color="secondary"
        data-testid="ontology-working-previous"
        isDisabled={cursors.length === 1 || !hasCoherentPreview}
        size="sm"
        onPress={() => setCursors((current) => current.slice(0, -1))}>
        {t('label.previous')}
      </Button>
      <Button
        color="secondary"
        data-testid="ontology-working-next"
        isDisabled={!changes.data?.paging.after || !hasCoherentPreview}
        size="sm"
        onPress={() =>
          setCursors((current) => [...current, changes.data?.paging.after])
        }>
        {t('label.next')}
      </Button>
    </Box>
  );

  const renderVersionError = () =>
    latestVersioned.isError && (
      <Alert variant="error">
        {t('message.ontology-version-unavailable')}
        <Button
          color="secondary"
          size="sm"
          onPress={() => void latestVersioned.refetch()}>
          {t('label.retry')}
        </Button>
      </Alert>
    );

  const renderVersionEditor = () =>
    latestVersioned.isSuccess && (
      <OntologyVersionEditor
        baseVersion={previewBaseVersion}
        bump={bump}
        isDisabled={editorIsDisabled}
        notes={releaseNotes}
        onBumpChange={setVersionBump}
        onNotesChange={setReleaseNotes}
      />
    );

  const renderValidation = () => (
    <OntologyReleaseValidation
      ontology={ontology}
      release={selectedId ? release : undefined}
    />
  );

  const renderPendingReviewAlert = () =>
    pendingReview && (
      <Alert variant="warning">
        {t('message.ontology-review-candidate-retained')}
      </Alert>
    );

  const renderChanges = () => (
    <Box direction="col" gap={5}>
      <div className="tw:grid tw:grid-cols-1 tw:gap-5 tw:md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Box direction="col" gap={4}>
          {renderChangesHeading()}
          {renderChangeStatus()}
          {hasCoherentPreview && changes.data && (
            <ul className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-3 tw:p-0">
              {changes.data.data.map((change) => (
                <li key={change.entity.id + ':' + change.memberKind}>
                  <Card size="sm">
                    <Card.Content>
                      <Typography size="text-sm" weight="semibold">
                        {getEntityName(change.entity)}
                      </Typography>
                    </Card.Content>
                  </Card>
                  <Typography color="secondary" size="text-xs">
                    {t(
                      'label.ontology-member-' + change.memberKind.toLowerCase()
                    )}{' '}
                    · {t('label.' + change.changeType.toLowerCase())}
                  </Typography>
                </li>
              ))}
            </ul>
          )}
          {renderChangesPagination()}
          {renderVersionError()}
          {renderVersionEditor()}
        </Box>
        {renderValidation()}
      </div>
      {renderPendingReviewAlert()}
      {renderFooter()}
    </Box>
  );

  const renderAiChanges = () => (
    <Box direction="col" gap={5}>
      <div className="tw:grid tw:grid-cols-1 tw:gap-6 tw:lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <Box className="tw:min-w-0" direction="col" gap={4}>
          {renderChangesHeading()}
          {renderChangeStatus()}
          {hasCoherentPreview && changes.data && (
            <AiChangeGroups changes={changes.data.data} />
          )}
          {renderChangesPagination()}
          {renderVersionError()}
        </Box>
        <Box className="tw:min-w-0" direction="col" gap={4}>
          {renderValidation()}
          {renderVersionEditor()}
        </Box>
      </div>
      {renderPendingReviewAlert()}
    </Box>
  );

  const renderReleases = () => (
    <OntologyReleaseHistory
      activeReleaseId={activeReleaseId}
      history={history}
      selectedReleaseId={selectedId}
      onSelect={setSelectedId}
    />
  );

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

  const renderAiPanel = () => {
    const isChanges = view === 'changes';

    return (
      <Box
        className={isChanges ? undefined : 'tw:pb-5'}
        direction="col"
        gap={4}>
        {renderStateError()}
        {isChanges ? renderAiChanges() : renderReleases()}
        {renderRelease()}
        {isChanges ? renderAiFooter() : null}
      </Box>
    );
  };

  if (isAiMode) {
    return renderAiPanel();
  }

  return (
    <Box direction="col" gap={4}>
      {renderStateError()}
      {view === 'changes' ? renderChanges() : renderReleases()}
      {renderRelease()}
    </Box>
  );
};

export default OntologyReleasePanel;
