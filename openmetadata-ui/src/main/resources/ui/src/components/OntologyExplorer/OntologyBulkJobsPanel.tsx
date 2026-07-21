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
  Button,
  Card,
  ProgressBar,
  Typography,
} from '@openmetadata/ui-core-components';
import { RefreshCcw01 } from '@untitledui/icons';
import { useTranslation } from 'react-i18next';
import {
  OntologyBulkJob,
  Operation,
  Status,
} from '../../generated/api/data/ontologyBulkJob';
import { isActiveOntologyBulkJob } from './OntologyBulkAuthoring.utils';

interface OntologyBulkJobsPanelProps {
  hasLoadError: boolean;
  isCancelling: boolean;
  isLoading: boolean;
  jobs: OntologyBulkJob[];
  onCancel: (jobId: number) => void;
  onRefresh: () => void;
  onViewResult: (job: OntologyBulkJob) => void;
}

const OntologyBulkJobsPanel = ({
  hasLoadError,
  isCancelling,
  isLoading,
  jobs,
  onCancel,
  onRefresh,
  onViewResult,
}: OntologyBulkJobsPanelProps) => {
  const { t } = useTranslation();

  const statusLabel = (status: Status): string => {
    let label: string;

    switch (status) {
      case Status.Queued:
        label = t('label.queued');

        break;
      case Status.Running:
        label = t('label.running');

        break;
      case Status.Completed:
        label = t('label.completed');

        break;
      case Status.Failed:
        label = t('label.failed');

        break;
      case Status.Cancelled:
        label = t('label.cancelled');

        break;
    }

    return label;
  };

  const operationLabel = (operation: Operation): string => {
    let label: string;

    switch (operation) {
      case Operation.CSVUpsert:
        label = `${t('label.csv')} ${t('label.upload')}`;

        break;
      case Operation.FindReplace:
        label = `${t('label.find')} / ${t('label.replace')}`;

        break;
      case Operation.RetypeRelationships:
        label = `${t('label.relationship-type')} ${t('label.edit')}`;

        break;
    }

    return label;
  };

  return (
    <Card className="tw:flex tw:flex-col tw:gap-4 tw:border tw:border-secondary tw:p-5 tw:ring-0">
      <div className="tw:flex tw:items-center tw:justify-between tw:gap-3">
        <Typography as="h3" size="text-md" weight="semibold">
          {t('label.background-job-plural')}
        </Typography>
        <Button
          color="secondary"
          iconLeading={RefreshCcw01}
          isLoading={isLoading}
          size="sm"
          onClick={onRefresh}>
          {t('label.refresh')}
        </Button>
      </div>

      {hasLoadError ? (
        <Alert title={t('server.unexpected-error')} variant="error" />
      ) : null}

      {jobs.length === 0 && !isLoading ? (
        <Typography as="p" className="tw:text-tertiary" size="text-sm">
          {t('label.no-data')}
        </Typography>
      ) : null}

      <div className="tw:flex tw:flex-col tw:gap-3">
        {jobs.map((job) => (
          <div
            className="tw:flex tw:flex-col tw:gap-3 tw:rounded-lg tw:border tw:border-secondary tw:bg-secondary tw:p-4"
            data-testid={`ontology-bulk-job-${job.id}`}
            key={job.id}>
            <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2">
              <div className="tw:flex tw:items-center tw:gap-2">
                <Typography as="span" size="text-sm" weight="semibold">
                  {operationLabel(job.operation)}
                </Typography>
                <Badge color="gray" size="sm" type="pill-color">
                  {statusLabel(job.status)}
                </Badge>
              </div>
              <div className="tw:flex tw:gap-2">
                {job.result ? (
                  <Button
                    color="secondary"
                    size="sm"
                    onClick={() => onViewResult(job)}>
                    {t('label.view')} {t('label.result')}
                  </Button>
                ) : null}
                {isActiveOntologyBulkJob(job) ? (
                  <Button
                    color="secondary-destructive"
                    isDisabled={isCancelling}
                    size="sm"
                    onClick={() => onCancel(job.id)}>
                    {t('label.cancel')}
                  </Button>
                ) : null}
              </div>
            </div>
            {isActiveOntologyBulkJob(job) ? (
              <ProgressBar max={Math.max(job.total, 1)} value={job.progress} />
            ) : null}
            {job.error ? (
              <Typography
                as="p"
                className="tw:text-error-primary"
                size="text-sm">
                {job.error}
              </Typography>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
};

export default OntologyBulkJobsPanel;
