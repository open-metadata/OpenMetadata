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
  Box,
  Button,
  Card,
  Typography,
} from '@openmetadata/ui-core-components';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { VersionBump } from '../../../../generated/api/data/captureOntologyRelease';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { useOntologyPublication } from '../../../../hooks/governance/ontology/useOntologyPublication';
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
  const [versionBump, setVersionBump] = useState<VersionBump>();
  const [releaseNotes, setReleaseNotes] = useState('');
  const [reviewBaseVersion, setReviewBaseVersion] = useState<string>();
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [cursorRevision, setCursorRevision] = useState<string>();
  const {
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
    working.isSuccess,
    !working.isFetching,
  ].every(Boolean);
  const baseVersion = latestVersioned.data?.semanticVersion;
  const bump =
    versionBump ?? (baseVersion ? VersionBump.Minor : VersionBump.Major);
  const canCapture = [
    canPublish,
    hasCoherentPreview,
    latestVersioned.isSuccess,
    !latestVersioned.isFetching,
    !pendingReview,
  ].every(Boolean);
  const metadata = { versionBump: bump, releaseNotes };
  const canRetryReview = canPublish && Boolean(pendingReview);
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
          isActive={release.id === working.data?.state.activeReleaseId}
          release={release}
          showExport={view !== 'releases'}
          onActivate={activate}
          onRequestApproval={requestApproval}
        />
      )
    );
  };

  const renderFooter = () => (
    <Box
      align="center"
      className="tw:border-t tw:border-secondary tw:pt-4"
      gap={3}
      justify="between"
      wrap="wrap">
      <Typography data-testid="ontology-version-preview" size="text-sm">
        {latestVersioned.isSuccess
          ? (previewBaseVersion ?? '0.0.0') +
            ' → ' +
            (pendingReview?.semanticVersion ??
              nextSemanticVersion(previewBaseVersion, bump))
          : t('label.loading')}
      </Typography>
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
    </Box>
  );

  const renderChanges = () => (
    <Box direction="col" gap={5}>
      <div className="tw:grid tw:grid-cols-1 tw:gap-5 tw:md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
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
                setCursors((current) => [
                  ...current,
                  changes.data?.paging.after,
                ])
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
            <OntologyVersionEditor
              baseVersion={previewBaseVersion}
              bump={bump}
              isDisabled={editorIsDisabled}
              notes={releaseNotes}
              onBumpChange={setVersionBump}
              onNotesChange={setReleaseNotes}
            />
          )}
        </Box>
        <OntologyReleaseValidation
          ontology={ontology}
          release={selectedId ? release : undefined}
        />
      </div>
      {pendingReview && (
        <Alert variant="warning">
          {t('message.ontology-review-candidate-retained')}
        </Alert>
      )}
      {renderFooter()}
    </Box>
  );

  const renderReleases = () => (
    <OntologyReleaseHistory
      activeReleaseId={working.data?.state.activeReleaseId}
      history={history}
      selectedReleaseId={selectedId}
      onSelect={setSelectedId}
    />
  );

  return (
    <Box direction="col" gap={4}>
      {view === 'changes' ? renderChanges() : renderReleases()}
      {renderRelease()}
    </Box>
  );
};

export default OntologyReleasePanel;
