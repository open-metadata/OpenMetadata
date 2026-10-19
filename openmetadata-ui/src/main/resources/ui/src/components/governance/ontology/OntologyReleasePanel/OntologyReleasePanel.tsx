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
  Typography,
} from '@openmetadata/ui-core-components';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { OntologyState } from '../../../../generated/type/ontologyState';
import { useOntologyPublication } from '../../../../hooks/governance/ontology/useOntologyPublication';
import { getOntologyWorkingDiff } from '../../../../rest/ontologyAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import OntologyReleasePicker from '../OntologyReleasePicker/OntologyReleasePicker';
import OntologyReleaseDetails from './OntologyReleaseDetails';

interface OntologyReleasePanelProps {
  ontology: Ontology;
  canEdit: boolean;
  view: 'changes' | 'releases';
}

const isSameWorkingState = (
  first: OntologyState | undefined,
  current: OntologyState | undefined
) => {
  if (!first || !current) {
    return false;
  }

  return (
    current.ontologyId === first.ontologyId &&
    current.workingRevision === first.workingRevision &&
    current.activationRevision === first.activationRevision &&
    current.activeReleaseId === first.activeReleaseId
  );
};

const OntologyReleasePanel = ({
  ontology,
  canEdit,
  view,
}: OntologyReleasePanelProps) => {
  const { t } = useTranslation();
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
    capture,
    requestApproval,
    activate,
  } = useOntologyPublication(ontology.id, canEdit);
  const firstPageRevision = working.data
    ? `${working.data.state.workingRevision}:${working.data.state.activationRevision}`
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
    enabled:
      view === 'changes' &&
      cursors.length > 1 &&
      cursorRevision === firstPageRevision,
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
  const canCapture = canPublish && hasCoherentPreview;
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
          onActivate={activate}
          onRequestApproval={requestApproval}
        />
      )
    );
  };

  const renderChanges = () => (
    <Box direction="col" gap={4}>
      {working.data && (
        <>
          <Typography>
            {t('label.draft')} · {t('label.version')}{' '}
            {working.data.state.workingRevision}
          </Typography>
          <Typography>
            {working.data.paging.total} {t('label.pending-changes')}
          </Typography>
        </>
      )}
      {renderChangeStatus()}
      {hasCoherentPreview && changes.data && (
        <ul className="tw:m-0 tw:list-none tw:p-0">
          {changes.data.data.map((change) => (
            <li key={`${change.memberKind}:${change.entity.id}`}>
              {getEntityName(change.entity)} ·{' '}
              {t(`label.${change.changeType.toLowerCase()}`)}
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
            setCursors((current) => [...current, changes.data?.paging.after])
          }>
          {t('label.next')}
        </Button>
      </Box>
      <Button
        color="primary"
        isDisabled={!canCapture}
        onPress={() => {
          if (hasCoherentPreview && changes.data) {
            void capture(changes.data.state);
          }
        }}>
        {t('label.capture-release')}
      </Button>
    </Box>
  );

  const renderReleases = () => (
    <OntologyReleasePicker
      key={working.data?.state.lastReleaseRevision}
      label={t('label.ontology-release')}
      ontologyId={ontology.id}
      value={release}
      onChange={(value) => setSelectedId(value?.id)}
    />
  );

  const renderView = () => {
    if (view === 'changes') {
      return (
        <>
          {renderChanges()}
          {selectedId ? renderRelease() : null}
        </>
      );
    }

    return (
      <>
        {renderReleases()}
        {renderRelease()}
      </>
    );
  };

  return (
    <Box direction="col" gap={4}>
      {renderView()}
    </Box>
  );
};

export default OntologyReleasePanel;
