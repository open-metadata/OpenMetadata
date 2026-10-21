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
import { useQueries, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OntologyReleaseDiff } from '../../../../generated/api/data/ontologyReleaseDiff';
import {
  getOntologyReleaseDiff,
  getOntologyReleaseMember,
} from '../../../../rest/ontologyAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import OntologyReviewDefinition from './OntologyReviewDefinition';

interface OntologyReviewReleaseProps {
  baseReleaseId?: string;
  releaseId: string;
  onReadyChange?: (ready: boolean) => void;
}

const OntologyReviewRelease = ({
  baseReleaseId,
  releaseId,
  onReadyChange,
}: OntologyReviewReleaseProps) => {
  const { t } = useTranslation();
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [selected, setSelected] =
    useState<OntologyReleaseDiff['data'][number]>();
  const after = cursors[cursors.length - 1];
  const page = useQuery({
    queryKey: ['ontology-review-members', releaseId, baseReleaseId, after],
    retry: false,
    gcTime: 0,
    queryFn: ({ signal }) =>
      getOntologyReleaseDiff(
        releaseId,
        { baseReleaseId, limit: 25, after },
        signal
      ),
  });
  const snapshots = selected
    ? [
        { releaseId: selected.beforeReleaseId, label: 'label.before' },
        { releaseId: selected.afterReleaseId, label: 'label.after' },
      ].filter((snapshot) => snapshot.releaseId)
    : [];
  const members = useQueries({
    queries: snapshots.map((snapshot) => ({
      queryKey: [
        'ontology-review-member',
        snapshot.releaseId,
        selected?.memberKind,
        selected?.entity.id,
      ],
      retry: false,
      gcTime: 0,
      queryFn: ({ signal }: { signal: AbortSignal }) => {
        if (!selected || !snapshot.releaseId) {
          throw new Error('Missing captured ontology member');
        }

        return getOntologyReleaseMember(
          snapshot.releaseId,
          selected.memberKind,
          selected.entity.id,
          signal
        );
      },
    })),
  });

  const ready =
    page.isSuccess &&
    !page.isFetching &&
    members.every((member) => member.isSuccess && !member.isFetching);
  useEffect(() => {
    onReadyChange?.(ready);

    return () => onReadyChange?.(false);
  }, [ready, onReadyChange]);

  if (page.isError) {
    return (
      <Alert variant="error">{t('message.ontology-review-unavailable')}</Alert>
    );
  }

  const renderMember = () => {
    if (!selected) {
      return null;
    }
    if (members.some((member) => member.isError)) {
      return (
        <Alert variant="error">
          {t('message.ontology-review-unavailable')}
        </Alert>
      );
    }
    if (members.some((member) => member.isPending)) {
      return <Typography role="status">{t('label.loading')}</Typography>;
    }

    return members.map(
      (member, index) =>
        member.data && (
          <Box direction="col" gap={2} key={snapshots[index].label}>
            <Typography as="h4">{t(snapshots[index].label)}</Typography>
            <OntologyReviewDefinition definition={member.data.payload} />
          </Box>
        )
    );
  };

  return (
    <Box direction="col" gap={3}>
      {page.isPending ? (
        <Typography role="status">{t('label.loading')}</Typography>
      ) : (
        <ul className="tw:m-0 tw:list-none tw:p-0">
          {page.data.data.map((change) => (
            <li
              className="tw:flex tw:items-center tw:gap-2"
              key={`${change.memberKind}:${change.entity.id}`}>
              <Button
                color="link-color"
                size="sm"
                onPress={() => setSelected(change)}>
                {getEntityName(change.entity)}
              </Button>
              <Typography as="span">
                {t(`label.${change.changeType.toLowerCase()}`)}
              </Typography>
            </li>
          ))}
        </ul>
      )}
      <Box gap={2}>
        <Button
          color="secondary"
          isDisabled={page.isPending || cursors.length === 1}
          size="sm"
          onPress={() => {
            setSelected(undefined);
            setCursors((current) => current.slice(0, -1));
          }}>
          {t('label.previous')}
        </Button>
        <Button
          color="secondary"
          isDisabled={page.isPending || !page.data?.paging.after}
          size="sm"
          onPress={() => {
            setSelected(undefined);
            setCursors((current) => [...current, page.data?.paging.after]);
          }}>
          {t('label.next')}
        </Button>
      </Box>
      {renderMember()}
    </Box>
  );
};

export default OntologyReviewRelease;
