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
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ontology } from '../../../../generated/entity/data/ontology';
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

const OntologyReleasePanel = ({
  ontology,
  canEdit,
  view,
}: OntologyReleasePanelProps) => {
  const { t } = useTranslation();
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
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
  const after = cursors[cursors.length - 1];
  const page = useQuery({
    queryKey: ['ontology-working-diff', ontology.id, after],
    queryFn: ({ signal }) =>
      getOntologyWorkingDiff(ontology.id, { limit: 25, after }, signal),
    enabled: view === 'changes' && cursors.length > 1,
    gcTime: 0,
    retry: false,
  });
  const changes = cursors.length === 1 ? working : page;
  const canPublish =
    canEdit && !isBusy && working.isSuccess && !working.isFetching;

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
      {working.isError && cursors.length > 1 && (
        <Alert variant="error">
          {t('message.ontology-review-unavailable')}
        </Alert>
      )}
      {changes.isError && (
        <Alert variant="error">
          {t('message.ontology-review-unavailable')}
        </Alert>
      )}
      {changes.isPending && (
        <Typography role="status">{t('label.loading')}</Typography>
      )}
      {changes.data && (
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
          isDisabled={cursors.length === 1 || changes.isFetching}
          size="sm"
          onPress={() => setCursors((current) => current.slice(0, -1))}>
          {t('label.previous')}
        </Button>
        <Button
          color="secondary"
          isDisabled={!changes.data?.paging.after || changes.isFetching}
          size="sm"
          onPress={() =>
            setCursors((current) => [...current, changes.data?.paging.after])
          }>
          {t('label.next')}
        </Button>
      </Box>
      <Button color="primary" isDisabled={!canPublish} onPress={capture}>
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
