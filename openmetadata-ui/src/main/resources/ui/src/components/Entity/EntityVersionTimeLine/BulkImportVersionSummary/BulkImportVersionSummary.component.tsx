/*
 *  Copyright 2025 Collate.
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
  Button,
  Dialog,
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
import { capitalize, isUndefined } from 'lodash';
import { useState } from 'react';
import DataGrid from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import { useTranslation } from 'react-i18next';
import { usePapaParse } from 'react-papaparse';
import { CSVImportResult } from '../../../../generated/type/csvImportResult';
import { renderColumnDataEditor } from '../../../../utils/CSV/CSV.utils';

interface BulkImportVersionSummaryProps {
  csvImportResult: CSVImportResult;
}

const buildColumn = (column: string) => ({
  key: column,
  name: capitalize(column),
  sortable: false,
  resizable: true,
  minWidth: column === 'status' ? 70 : 180,
  renderCell: (data: { row: Record<string, string> }) =>
    renderColumnDataEditor(column, {
      value: data.row[column],
      data: { details: '', glossaryStatus: '' },
    }),
});

const buildRow = (
  cols: string[],
  row: string[],
  idx: number
): Record<string, string> => {
  const acc: Record<string, string> = { id: idx + '' };
  row.forEach((value, index) => {
    if (!isUndefined(cols[index])) {
      acc[cols[index]] = value;
    }
  });

  return acc;
};

export const BulkImportVersionSummary = ({
  csvImportResult,
}: BulkImportVersionSummaryProps) => {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { readString } = usePapaParse();
  const [tableData, setTableData] = useState<{
    columns: { key: string; name: string }[];
    dataSource: Record<string, string>[];
  }>();

  const handleViewMore = () => {
    if (!tableData && csvImportResult.importResultsCsv) {
      readString(csvImportResult.importResultsCsv, {
        worker: true,
        skipEmptyLines: true,
        complete: (results) => {
          const [cols, ...rows] = results.data as string[][];
          const columns = cols?.map(buildColumn);
          const dataSource = rows.map((row, idx) => buildRow(cols, row, idx));
          setTableData({ columns, dataSource });
        },
      });
    }
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setIsModalOpen(false);
  };

  return (
    <>
      <div className="tw:mt-1">
        <div className="tw:flex tw:flex-col tw:gap-1 tw:mb-1">
          <div className="tw:flex">
            <div className="tw:min-w-30">
              <Typography as="span" className="tw:text-gray-500 tw:text-xs">
                {t('label.rows-processed')}:
              </Typography>
            </div>
            <Typography
              as="span"
              className="tw:text-xs tw:font-medium"
              data-testid="processed-row">
              {csvImportResult.numberOfRowsProcessed}
            </Typography>
          </div>
          <div className="tw:flex">
            <div className="tw:min-w-30">
              <Typography as="span" className="tw:text-gray-500 tw:text-xs">
                {t('label.passed')}:
              </Typography>
            </div>
            <Typography
              as="span"
              className="tw:text-xs tw:font-medium"
              data-testid="passed-row">
              {csvImportResult.numberOfRowsPassed}
            </Typography>
          </div>
          <div className="tw:flex">
            <div className="tw:min-w-30">
              <Typography as="span" className="tw:text-gray-500 tw:text-xs">
                {t('label.failed')}:
              </Typography>
            </div>
            <Typography
              as="span"
              className="tw:text-xs tw:font-medium"
              data-testid="failed-row">
              {csvImportResult.numberOfRowsFailed}
            </Typography>
          </div>
        </div>
        <Button
          className="tw:text-xs"
          color="link-color"
          data-testid="view-more-button"
          size="sm"
          onClick={handleViewMore}>
          {t('label.view-more')}
        </Button>
      </div>
      {isModalOpen && (
        <ModalOverlay
          isOpen
          className="tw:z-1100"
          onOpenChange={(open) => !open && handleClose()}>
          <Modal>
            <Dialog
              showCloseButton
              title={t('label.bulk-import-entity', {
                entity: t('label.detail-plural'),
              })}
              width={800}
              onClose={handleClose}>
              <Dialog.Content className="tw:overflow-auto">
                <div
                  data-testid="bulk-import-details-modal"
                  style={{ height: '60vh', maxHeight: 700 }}>
                  {tableData && (
                    <div className="om-rdg tw:flex-1 tw:min-h-0">
                      <DataGrid
                        className="rdg-light"
                        columns={tableData.columns}
                        rows={tableData.dataSource}
                        style={{ height: '100%' }}
                      />
                    </div>
                  )}
                </div>
              </Dialog.Content>
            </Dialog>
          </Modal>
        </ModalOverlay>
      )}
    </>
  );
};
