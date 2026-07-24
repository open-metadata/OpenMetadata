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
  Button,
  Card,
  Typography,
} from '@openmetadata/ui-core-components';
import { Download01 } from '@untitledui/icons';
import { useTranslation } from 'react-i18next';
import { OntologyBulkResultArtifact } from '../../generated/api/data/ontologyBulkResultArtifact';
import { downloadFile } from '../../utils/Export/ExportUtils';
import { artifactFileName } from './OntologyBulkAuthoring.utils';

interface OntologyBulkResultPanelProps {
  jobId?: number;
  result: OntologyBulkResultArtifact;
}

interface ResultCount {
  label: string;
  value: number;
}

const OntologyBulkResultPanel = ({
  jobId,
  result,
}: OntologyBulkResultPanelProps) => {
  const { t } = useTranslation();
  const counts: ResultCount[] = [
    { label: t('label.total'), value: result.totalRows },
    { label: t('label.valid'), value: result.validRows },
    { label: t('label.invalid'), value: result.invalidRows },
    { label: t('label.no-change'), value: result.unchangedRows },
  ];

  const handleDownload = () => {
    downloadFile(
      JSON.stringify(result, null, 2),
      artifactFileName(jobId),
      'application/json;charset=utf-8;'
    );
  };

  return (
    <Card
      className="tw:flex tw:flex-col tw:gap-4 tw:border tw:border-secondary tw:p-5"
      data-testid="ontology-bulk-result">
      <div className="tw:flex tw:flex-wrap tw:items-start tw:justify-between tw:gap-3">
        <div>
          <Typography as="h3" size="text-md" weight="semibold">
            {result.dryRun ? t('label.preview') : t('label.draft-created')}
          </Typography>
          {result.changeSet ? (
            <Typography as="p" className="tw:text-tertiary" size="text-sm">
              {result.changeSet.displayName ?? result.changeSet.name}
            </Typography>
          ) : null}
        </div>
        <Button
          color="secondary"
          iconLeading={Download01}
          size="sm"
          onClick={handleDownload}>
          {t('label.download')} {t('label.result')}
        </Button>
      </div>

      <div className="tw:grid tw:grid-cols-2 tw:gap-3 tw:lg:grid-cols-4">
        {counts.map((count) => (
          <div
            className="tw:rounded-lg tw:border tw:border-secondary tw:bg-secondary tw:p-3"
            key={count.label}>
            <Typography as="p" className="tw:text-tertiary" size="text-xs">
              {count.label}
            </Typography>
            <Typography as="p" size="display-xs" weight="semibold">
              {count.value}
            </Typography>
          </div>
        ))}
      </div>

      {result.errors.length > 0 ? (
        <div className="tw:overflow-x-auto">
          <table className="tw:w-full tw:border-collapse tw:text-left tw:text-sm">
            <thead>
              <tr className="tw:border-b tw:border-secondary tw:text-tertiary">
                <th className="tw:px-3 tw:py-2">{t('label.row')}</th>
                <th className="tw:px-3 tw:py-2">{t('label.code')}</th>
                <th className="tw:px-3 tw:py-2">
                  {t('label.message-lowercase')}
                </th>
              </tr>
            </thead>
            <tbody>
              {result.errors.map((error) => (
                <tr
                  className="tw:border-b tw:border-secondary"
                  key={`${error.rowNumber}-${error.code}-${error.message}`}>
                  <td className="tw:px-3 tw:py-2">{error.rowNumber}</td>
                  <td className="tw:px-3 tw:py-2 tw:font-mono tw:text-xs">
                    {error.code}
                  </td>
                  <td className="tw:px-3 tw:py-2">{error.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {result.errorsTruncated ? (
            <Alert
              className="tw:mt-3"
              title={`${t('label.error-plural')} · ${t('label.max')}`}
              variant="warning"
            />
          ) : null}
        </div>
      ) : (
        <Alert title={t('label.valid')} variant="success" />
      )}
    </Card>
  );
};

export default OntologyBulkResultPanel;
