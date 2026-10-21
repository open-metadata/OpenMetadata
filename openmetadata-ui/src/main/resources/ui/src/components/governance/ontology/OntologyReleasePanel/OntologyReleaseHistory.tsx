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
import { useTranslation } from 'react-i18next';
import { useOntologyPublication } from '../../../../hooks/governance/ontology/useOntologyPublication';
import { formatDateTimeLong } from '../../../../utils/date-time/DateTimeUtils';
import OntologyReleaseExport from './OntologyReleaseExport';

interface OntologyReleaseHistoryProps {
  history: ReturnType<typeof useOntologyPublication>['history'];
  activeReleaseId?: string;
  selectedReleaseId?: string;
  onSelect: (id: string) => void;
}

const OntologyReleaseHistory = ({
  history,
  activeReleaseId,
  selectedReleaseId,
  onSelect,
}: OntologyReleaseHistoryProps) => {
  const { t } = useTranslation();
  const releases = history.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <Box data-testid="ontology-release-history" direction="col" gap={4}>
      {history.isPending && (
        <Typography role="status">{t('label.loading')}</Typography>
      )}
      {history.isError && (
        <Alert variant="error">
          {t('message.ontology-review-unavailable')}
          <Button
            color="secondary"
            size="sm"
            onPress={() => void history.refetch()}>
            {t('label.retry')}
          </Button>
        </Alert>
      )}
      {history.isSuccess && releases.length === 0 && (
        <Typography>{t('message.no-data-available')}</Typography>
      )}
      <ol className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-3 tw:p-0">
        {releases.map((release, index) => (
          <li key={release.id}>
            <Box align="start" gap={3} justify="between">
              <Box className="tw:min-w-0 tw:flex-1" direction="col" gap={1}>
                <Box align="center" gap={2} wrap="wrap">
                  <Button
                    aria-expanded={selectedReleaseId === release.id}
                    color={
                      selectedReleaseId === release.id
                        ? 'link-color'
                        : 'link-gray'
                    }
                    data-testid={`ontology-release-select-${release.id}`}
                    size="sm"
                    onPress={() => onSelect(release.id)}>
                    {release.semanticVersion ??
                      t('label.ontology-release-revision', {
                        revision: release.releaseRevision,
                      })}
                  </Button>
                  {release.id === activeReleaseId && (
                    <Badge color="success">{t('label.active')}</Badge>
                  )}
                  {index === 0 && (
                    <Badge color="blue">{t('label.latest')}</Badge>
                  )}
                  <Badge>
                    {t(
                      `label.${release.entityStatus
                        .toLowerCase()
                        .replaceAll(' ', '-')}`
                    )}
                  </Badge>
                  <Typography color="secondary" size="text-xs">
                    {formatDateTimeLong(release.sealedAt)} · {release.sealedBy}
                  </Typography>
                </Box>
                {release.releaseNotes && (
                  <Typography
                    className="tw:whitespace-pre-wrap tw:break-words"
                    size="text-sm">
                    {release.releaseNotes}
                  </Typography>
                )}
              </Box>
              <OntologyReleaseExport releaseId={release.id} />
            </Box>
            <Divider className="tw:mt-3" />
          </li>
        ))}
      </ol>
      {history.hasNextPage && (
        <Button
          color="secondary"
          data-testid="ontology-release-load-more"
          isDisabled={history.isFetchingNextPage}
          isLoading={history.isFetchingNextPage}
          size="sm"
          onPress={() => void history.fetchNextPage()}>
          {t('label.load-more')}
        </Button>
      )}
      {history.data?.pages.length === 40 &&
        history.data.pages[39].paging.after && (
          <Typography color="secondary" size="text-sm">
            {t('message.ontology-history-limit')}
          </Typography>
        )}
    </Box>
  );
};

export default OntologyReleaseHistory;
