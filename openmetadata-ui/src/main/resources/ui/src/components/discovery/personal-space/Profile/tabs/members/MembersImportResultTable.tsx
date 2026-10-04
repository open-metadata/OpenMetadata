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
    Badge,
    Box,
    Table,
    Typography
} from '@openmetadata/ui-core-components';
import { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePapaParse } from 'react-papaparse';
import { Status } from '../../../../../../generated/type/csvImportResult';
import type { MembersImportResultTableProps } from './Members.types';

const STATUS_KEY = 'status';
const DETAILS_KEY = 'details';
const EMPTY_PLACEHOLDER = '--';

interface ImportRow {
  id: string;
  cells: Record<string, string>;
}

interface ParsedResult {
  headers: string[];
  rows: ImportRow[];
}

const toImportRows = (data: string[][]): ParsedResult => {
  const nonEmpty = data.filter((row) => row.some((cell) => cell !== ''));
  const [headerRow = [], ...dataRows] = nonEmpty;

  return {
    headers: headerRow,
    rows: dataRows.map((row, index) => {
      const cells = headerRow.reduce<Record<string, string>>(
        (record, header, column) => {
          record[header] = row[column] ?? '';

          return record;
        },
        {}
      );

      return { id: `${index}-${cells[headerRow[1]] ?? ''}`, cells };
    }),
  };
};

// The result CSV carries one `status`/`details` pair per row — `status` gets a
// coloured badge (with the failure reason inline), `details` is folded into it,
// so every other header becomes a plain text column in its CSV order.
const MembersImportResultTable: FC<MembersImportResultTableProps> = ({
  csvImportResult,
}) => {
  const { t } = useTranslation();
  const { readString } = usePapaParse();
  const [parsed, setParsed] = useState<ParsedResult>({ headers: [], rows: [] });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    if (!csvImportResult.importResultsCsv) {
      setParsed({ headers: [], rows: [] });
      setIsLoading(false);

      return;
    }

    readString<string[]>(csvImportResult.importResultsCsv, {
      worker: true,
      complete: (results) => {
        setParsed(toImportRows(results.data as string[][]));
        setIsLoading(false);
      },
    });
  }, [csvImportResult.importResultsCsv, readString]);

  const dataColumns = useMemo(
    () =>
      parsed.headers.filter(
        (header) => header !== STATUS_KEY && header !== DETAILS_KEY
      ),
    [parsed.headers]
  );

  if (isLoading) {
    return (
      <Typography className="tw:text-tertiary" size="text-sm">
        {t('label.loading')}
      </Typography>
    );
  }

  return (
    <Table
      stickyHeader
      aria-label={t('label.import-entity', { entity: t('label.result') })}
      containerClassName="tw:rounded-lg tw:border tw:border-secondary"
      data-testid="import-result-table"
      size="sm">
      <Table.Header>
        <Table.Head id={STATUS_KEY} label={t('label.status')} />
        {dataColumns.map((header) => (
          <Table.Head
            id={header}
            key={header}
            label={header.replace(/\*$/, '')}
          />
        ))}
      </Table.Header>
      <Table.Body>
        {parsed.rows.map(({ id, cells }) => {
          const isFailure = cells[STATUS_KEY] === Status.Failure;

          return (
            <Table.Row id={id} key={id}>
              <Table.Cell>
                <Box align="center" direction="row" gap={2}>
                  <Badge
                    color={isFailure ? 'error' : 'success'}
                    data-testid={isFailure ? 'failure-badge' : 'success-badge'}
                    size="sm"
                    type="pill-color">
                    {isFailure ? t('label.failed') : t('label.success')}
                  </Badge>
                  {isFailure && cells[DETAILS_KEY] && (
                    <Typography
                      className="tw:text-error-primary"
                      size="text-sm">
                      {cells[DETAILS_KEY]}
                    </Typography>
                  )}
                </Box>
              </Table.Cell>
              {dataColumns.map((header) => (
                <Table.Cell key={header}>
                  <Typography className="tw:text-secondary" size="text-sm">
                    {cells[header] || EMPTY_PLACEHOLDER}
                  </Typography>
                </Table.Cell>
              ))}
            </Table.Row>
          );
        })}
      </Table.Body>
    </Table>
  );
};

export default MembersImportResultTable;
