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
import { BadgeWithIcon, Button } from '@openmetadata/ui-core-components';
import { Edit03, FilterLines, RefreshCcw01 } from '@untitledui/icons';
import { isEmpty, startCase } from 'lodash';
import { useEffect, useMemo } from 'react';
import type {
  Column,
  ColumnOrColumnGroup,
  RenderCellProps,
} from 'react-data-grid';
import { useTranslation } from 'react-i18next';
import { readString } from 'react-papaparse';
import { useNavigate } from 'react-router-dom';
import { ENTITY_BULK_EDIT_STEPS } from '../../constants/BulkEdit.constants';
import { ExportTypes } from '../../constants/Export.constants';
import { EntityType } from '../../enums/entity.enum';
import { useFqn } from '../../hooks/useFqn';
import {
  getBulkEditCSVExportEntityApi,
  getBulkEntityNavigationPath,
} from '../../utils/EntityBulkEdit/EntityBulkEditUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import Banner from '../common/Banner/Banner';
import { LazyDataGrid } from '../common/DataGrid/LazyDataGrid';
import CsvWorkflowHeader from '../common/EntityImport/CsvWorkflowHeader/CsvWorkflowHeader.component';
import { ImportStatus } from '../common/EntityImport/ImportStatus/ImportStatus.component';
import Loader from '../common/Loader/Loader';
import { useEntityExportModalProvider } from '../Entity/EntityExportModalProvider/EntityExportModalProvider.component';
import { BulkEditEntityProps } from './BulkEditEntity.interface';

const BULK_EDIT_COLUMN_WIDTHS: Record<string, number> = {
  operation: 170,
  name: 300,
  displayName: 220,
  description: 420,
  metricType: 140,
  unitOfMeasurement: 180,
  customUnitOfMeasurement: 160,
};

const BULK_EDIT_OPERATION_KEY = '__bulkEditOperation';
const BULK_EDIT_ORIGINAL_NAME_KEY = '__bulkEditOriginalName';

type BulkEditOperation = 'CREATE' | 'UPDATE' | 'NO_CHANGE' | 'SKIP';

const getBulkEditRowName = (row?: Record<string, string>) =>
  String(row?.name ?? row?.['name*'] ?? '');

const getBulkEditOperation = (
  row: Record<string, string>,
  originalRow: Record<string, string> | undefined,
  changedKeys: string[]
): BulkEditOperation => {
  if (row.status === 'failure') {
    return 'SKIP';
  }

  if (changedKeys.length === 0) {
    return 'NO_CHANGE';
  }

  return getBulkEditRowName(row) !== getBulkEditRowName(originalRow)
    ? 'CREATE'
    : 'UPDATE';
};

const getOperationLabel = (
  operation: BulkEditOperation,
  t: ReturnType<typeof useTranslation>['t']
) => {
  switch (operation) {
    case 'CREATE':
      return t('label.create');
    case 'UPDATE':
      return t('label.update');
    case 'SKIP':
      return t('label.skip');
    case 'NO_CHANGE':
    default:
      return t('label.no-change');
  }
};

const BulkEditOperationBadge = ({
  currentName,
  operation,
  originalName,
}: {
  currentName: string;
  operation: BulkEditOperation;
  originalName: string;
}) => {
  const { t } = useTranslation();
  const showRenameHint =
    operation === 'CREATE' && originalName && originalName !== currentName;

  return (
    <div className="bulk-edit-operation-cell">
      <span
        className={`bulk-edit-operation-badge bulk-edit-operation-badge-${operation.toLowerCase()}`}>
        <span className="bulk-edit-operation-dot" />
        {getOperationLabel(operation, t)}
      </span>
      {showRenameHint && (
        <span className="bulk-edit-operation-rename-hint">
          <span className="bulk-edit-operation-old-name">{originalName}</span>
          <span className="bulk-edit-operation-new-name">
            {t('label.new-lowercase')}
          </span>
        </span>
      )}
    </div>
  );
};

const BulkEditEntity = ({
  dataSource,
  initialDataSource,
  columns,
  breadcrumbList,
  activeStep,
  handleBack,
  handleValidate,
  isValidating,
  validationData,
  validateCSVData,
  activeAsyncImportJob,
  changedCellCount,
  changedCellKeysByRowId,
  changedRowCount,
  onCSVReadComplete,
  setGridContainer,
  handleCopy,
  handlePaste,
  handleOnRowsChange,
  sourceEntityType,
}: BulkEditEntityProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { fqn } = useFqn();
  const { entityType } = useRequiredParams<{ entityType: EntityType }>();
  const { triggerExportForBulkEdit, csvExportData, clearCSVExportData } =
    useEntityExportModalProvider();

  const translatedSteps = useMemo(
    () =>
      ENTITY_BULK_EDIT_STEPS.map((step) => ({
        ...step,
        name: t(step.name),
      })),
    [t]
  );
  const entityPluralDisplayName = useMemo(
    () =>
      t(`label.${entityType}-plural`, {
        defaultValue: startCase(entityType),
      }),
    [entityType, t]
  );

  const handleCancel = () => {
    clearCSVExportData();
    navigate(getBulkEntityNavigationPath(entityType, fqn, sourceEntityType));
  };

  const handleRevertChanges = () => {
    if (csvExportData) {
      readString(csvExportData, {
        worker: true,
        skipEmptyLines: true,
        complete: onCSVReadComplete,
      });
    }
  };

  useEffect(() => {
    triggerExportForBulkEdit({
      name: fqn,
      onExport: getBulkEditCSVExportEntityApi(entityType),
      exportTypes: [ExportTypes.CSV],
    });
  }, []);

  useEffect(() => {
    if (csvExportData) {
      readString(csvExportData, {
        worker: true,
        skipEmptyLines: true,
        complete: onCSVReadComplete,
      });
    }
  }, [csvExportData]);

  useEffect(() => {
    // clear the csvExportData data from the state
    return () => {
      clearCSVExportData();
    };
  }, []);

  /*
    Owner dropdown uses <ProfilePicture /> which uses useUserProfile hook
    useUserProfile hook uses useApplicationStore hook
    Updating store will trigger re-render of the component
    This will cause the owner dropdown or full grid to re-render
  */
  const editDataGrid = useMemo(() => {
    const dataSourceWithOperations = dataSource.map((row, index) => {
      const rowId = row.id ?? `${index}`;
      const originalRow = initialDataSource[index];
      const operation = getBulkEditOperation(
        row,
        originalRow,
        changedCellKeysByRowId[rowId] ?? []
      );

      return {
        ...row,
        [BULK_EDIT_OPERATION_KEY]: operation,
        [BULK_EDIT_ORIGINAL_NAME_KEY]: getBulkEditRowName(originalRow),
      };
    });
    const operationColumn: Column<Record<string, string>> = {
      key: BULK_EDIT_OPERATION_KEY,
      name: t('label.operation'),
      editable: false,
      frozen: true,
      minWidth: BULK_EDIT_COLUMN_WIDTHS.operation,
      width: BULK_EDIT_COLUMN_WIDTHS.operation,
      cellClass: (row) =>
        `rdg-cell-operation rdg-cell-operation-${String(
          row[BULK_EDIT_OPERATION_KEY] ?? 'NO_CHANGE'
        ).toLowerCase()}`,
      renderCell: ({ row }: RenderCellProps<Record<string, string>>) => (
        <BulkEditOperationBadge
          currentName={getBulkEditRowName(row)}
          operation={
            (row[BULK_EDIT_OPERATION_KEY] as BulkEditOperation) ?? 'NO_CHANGE'
          }
          originalName={row[BULK_EDIT_ORIGINAL_NAME_KEY] ?? ''}
        />
      ),
    };
    const gridColumns = [
      operationColumn,
      ...(columns as unknown as Column<Record<string, string>>[]).filter(
        (column) => column.key !== 'operation'
      ),
    ].map((column) => {
      const baseCellClass = column.cellClass;
      const columnKey = column.key.replace('*', '');
      const columnWidth = BULK_EDIT_COLUMN_WIDTHS[columnKey];

      return {
        ...column,
        minWidth: columnWidth ?? column.minWidth,
        width: columnWidth ?? column.width,
        cellClass: (row: Record<string, string>) => {
          const defaultClass =
            typeof baseCellClass === 'function'
              ? baseCellClass(row as never)
              : baseCellClass;
          const rowId = row.id ?? '';
          const isEdited = changedCellKeysByRowId[rowId]?.includes(column.key);

          return [defaultClass, isEdited ? 'rdg-cell-edited' : '']
            .filter(Boolean)
            .join(' ');
        },
      };
    });

    return (
      <div className="om-rdg bulk-edit-rdg" ref={setGridContainer}>
        <LazyDataGrid
          className="rdg-light"
          columns={
            gridColumns as unknown as ColumnOrColumnGroup<
              NoInfer<Record<string, string>>,
              unknown
            >[]
          }
          headerRowHeight={38}
          rowHeight={52}
          rows={dataSourceWithOperations}
          onCopy={handleCopy}
          onPaste={handlePaste}
          onRowsChange={handleOnRowsChange}
        />
      </div>
    );
  }, [
    changedCellKeysByRowId,
    columns,
    dataSource,
    handleCopy,
    handlePaste,
    handleOnRowsChange,
    initialDataSource,
  ]);

  const operationSummary = useMemo(() => {
    return dataSource.reduce(
      (summary, row, index) => {
        const rowId = row.id ?? `${index}`;
        const operation = getBulkEditOperation(
          row,
          initialDataSource[index],
          changedCellKeysByRowId[rowId] ?? []
        );

        return {
          ...summary,
          [operation]: summary[operation] + 1,
        };
      },
      {
        CREATE: 0,
        UPDATE: 0,
        NO_CHANGE: 0,
        SKIP: 0,
      } as Record<BulkEditOperation, number>
    );
  }, [changedCellKeysByRowId, dataSource, initialDataSource]);

  const operationSummaryItems: BulkEditOperation[] = [
    'CREATE',
    'UPDATE',
    'NO_CHANGE',
    'SKIP',
  ];

  return (
    <>
      <CsvWorkflowHeader
        activeStep={activeStep}
        breadcrumbList={breadcrumbList}
        currentLabel={t('label.bulk-edit')}
        description={t('message.bulk-edit-inline-help')}
        steps={translatedSteps}
        title={`${t('label.edit')} ${
          dataSource.length
        } ${entityPluralDisplayName.toLowerCase()}`}
      />

      <div>
        {activeAsyncImportJob?.jobId && (
          <Banner
            className="border-radius"
            isLoading={!activeAsyncImportJob.error}
            message={
              activeAsyncImportJob.error ?? activeAsyncImportJob.message ?? ''
            }
            type={activeAsyncImportJob.error ? 'error' : 'success'}
          />
        )}
      </div>

      {isEmpty(csvExportData) ? (
        <Loader />
      ) : (
        <>
          <div>
            {activeStep === 1 && (
              <div className="csv-import-card bulk-edit-card">
                <div className="csv-import-stack bulk-edit-stack">
                  <div className="csv-import-grid-toolbar bulk-edit-toolbar">
                    <div className="bulk-edit-summary">
                      <span className="csv-import-muted-text">
                        {t('message.bulk-edit-selected-count', {
                          count: dataSource.length,
                          entity: entityPluralDisplayName.toLowerCase(),
                        })}
                      </span>
                      {changedCellCount > 0 && (
                        <BadgeWithIcon
                          className="bulk-edit-edited-pill"
                          color="blue"
                          iconLeading={Edit03}
                          size="sm"
                          type="pill-color">
                          {`${changedCellCount} ${t(
                            'label.edited'
                          ).toLowerCase()}`}
                        </BadgeWithIcon>
                      )}
                    </div>
                    <div className="csv-import-action-row">
                      <Button color="secondary" iconLeading={FilterLines}>
                        {t('label.filter')}
                      </Button>
                      <Button
                        color="secondary"
                        iconLeading={RefreshCcw01}
                        onPress={handleRevertChanges}>
                        {t('label.revert-changes')}
                      </Button>
                    </div>
                  </div>
                  <div
                    className="bulk-edit-operation-summary"
                    data-testid="bulk-edit-operation-summary">
                    {operationSummaryItems.map((operation) => (
                      <div
                        className="bulk-edit-operation-summary-item"
                        key={operation}>
                        <span
                          className={`bulk-edit-operation-summary-count bulk-edit-operation-summary-count-${operation.toLowerCase()}`}>
                          {operationSummary[operation]}
                        </span>
                        <span className="bulk-edit-operation-summary-label">
                          {getOperationLabel(operation, t).toLowerCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="bulk-edit-grid-shell">{editDataGrid}</div>
                  {changedCellCount === 0 ? (
                    <span className="bulk-edit-empty-state csv-import-muted-text">
                      {t('label.no-bulk-edit-changes-yet')}
                    </span>
                  ) : (
                    <span className="bulk-edit-empty-state csv-import-muted-text">
                      {`${changedRowCount} ${entityPluralDisplayName.toLowerCase()} ${t(
                        'label.edited'
                      ).toLowerCase()}`}
                    </span>
                  )}
                </div>
              </div>
            )}

            {activeStep === 2 && validationData && (
              <div className="csv-import-card">
                <div className="csv-import-stack">
                  <div>
                    <ImportStatus csvImportResult={validationData} />
                  </div>

                  <div>
                    {validateCSVData && (
                      <div className="om-rdg">
                        <LazyDataGrid
                          className="rdg-light"
                          columns={validateCSVData.columns}
                          headerRowHeight={38}
                          rowHeight={44}
                          rows={validateCSVData.dataSource}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          {activeStep > 0 && (
            <div>
              <div className="float-right import-footer">
                {activeStep === 1 && (
                  <Button
                    color="secondary"
                    isDisabled={isValidating}
                    onPress={handleCancel}>
                    {t('label.cancel')}
                  </Button>
                )}

                {activeStep > 1 && (
                  <Button
                    color="secondary"
                    isDisabled={isValidating}
                    onPress={handleBack}>
                    {t('label.previous')}
                  </Button>
                )}
                {activeStep < 3 && (
                  <Button
                    className="m-l-sm"
                    color="primary"
                    isDisabled={
                      isValidating ||
                      (activeStep === 1 && changedCellCount === 0)
                    }
                    onPress={handleValidate}>
                    {activeStep === 2 ? t('label.update') : t('label.next')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
};

export default BulkEditEntity;
