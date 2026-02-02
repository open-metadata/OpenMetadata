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
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  useTheme,
} from '@mui/material';
import { capitalize } from 'lodash';
import { useState } from 'react';
import DataGrid from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import { useTranslation } from 'react-i18next';
import { usePapaParse } from 'react-papaparse';
import { ReactComponent as CloseIcon } from '../../../../assets/svg/close.svg';
import { CSVImportResult } from '../../../../generated/type/csvImportResult';
import { renderColumnDataEditor } from '../../../../utils/CSV/CSV.utils';

interface BulkImportVersionSummaryProps {
  csvImportResult: CSVImportResult;
}

export const BulkImportVersionSummary = ({
  csvImportResult,
}: BulkImportVersionSummaryProps) => {
  const theme = useTheme();
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
          const columns = cols?.map((column) => ({
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
          }));

          const dataSource = rows.map((row, idx) => {
            return row.reduce(
              (acc: Record<string, string>, value: string, index: number) => {
                acc[cols[index]] = value;
                acc['id'] = idx + '';

                return acc;
              },
              {} as Record<string, string>
            );
          });

          setTableData({ columns, dataSource });
        },
      });
    }
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setIsModalOpen(false);
  };

  const labelStyle = {
    color: theme.palette.grey[500],
    minWidth: 120,
  };

  const valueStyle = {
    fontWeight: theme.typography.h6.fontWeight,
    color: theme.palette.grey[900],
  };

  return (
    <>
      <Box sx={{ mt: 1 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex' }}>
            <Typography sx={labelStyle} variant="caption">
              {t('label.rows-processed')}:
            </Typography>
            <Typography
              data-testid="processed-row"
              sx={valueStyle}
              variant="caption">
              {csvImportResult.numberOfRowsProcessed}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex' }}>
            <Typography sx={labelStyle} variant="caption">
              {t('label.passed')}:
            </Typography>
            <Typography
              data-testid="passed-row"
              sx={valueStyle}
              variant="caption">
              {csvImportResult.numberOfRowsPassed}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex' }}>
            <Typography sx={labelStyle} variant="caption">
              {t('label.failed')}:
            </Typography>
            <Typography
              data-testid="failed-row"
              sx={valueStyle}
              variant="caption">
              {csvImportResult.numberOfRowsFailed}
            </Typography>
          </Box>
        </Box>
        <Button
          data-testid="view-more-button"
          size="small"
          sx={{
            p: 0,
            mt: 1,
            minWidth: 'auto',
            fontSize: theme.typography.caption.fontSize,
            color: theme.palette.primary.main,
            '&:hover': {
              color: theme.palette.allShades.brand[700],
            },
          }}
          variant="text"
          onClick={handleViewMore}>
          {t('label.view-more')}
        </Button>
      </Box>
      <Dialog
        data-testid="bulk-import-details-modal"
        maxWidth="md"
        open={isModalOpen}
        slotProps={{
          paper: {
            sx: {
              width: 800,
              maxWidth: '100%',
              height: '60vh',
              maxHeight: 700,
            },
          },
        }}
        sx={{ zIndex: 1300 }}
        onClose={handleClose}>
        <DialogTitle
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            p: '16px 24px !important',
            boxShadow: (theme) => theme.shadows[1],
            flexShrink: 0,
          }}>
          {t('label.bulk-import-entity', { entity: t('label.detail-plural') })}
          <IconButton
            data-testid="close-modal-button"
            size="small"
            onClick={handleClose}>
            <CloseIcon height={12} width={12} />
          </IconButton>
        </DialogTitle>
        <DialogContent
          sx={{
            p: '24px !important',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
          }}>
          {tableData && (
            <Box className="om-rdg" sx={{ flex: 1, minHeight: 0 }}>
              <DataGrid
                className="rdg-light"
                columns={tableData.columns}
                rows={tableData.dataSource}
                style={{ height: '100%' }}
              />
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
