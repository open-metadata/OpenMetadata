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
import { BadgeWithIcon, Button, Input } from '@openmetadata/ui-core-components';
import {
  Edit03,
  Lock01,
  Plus,
  RefreshCcw01,
  SearchLg,
  Trash01,
} from '@untitledui/icons';
import { isEmpty, startCase } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CellClickArgs,
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
import {
  OperationBadge,
  OperationSummary,
} from '../common/EntityImport/OperationCell/OperationCell.component';
import { BulkActionOperation } from '../common/EntityImport/OperationCell/OperationCell.interface';
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

const getBulkEditRowName = (row?: Record<string, string>) =>
  String(row?.name ?? row?.['name*'] ?? '');

const BULK_EDIT_NEW_ROW_KEY = '__bulkEditNewRow';

const getBulkEditOperation = (
  row: Record<string, string>,
  originalRow: Record<string, string> | undefined,
  changedKeys: string[]
): BulkActionOperation => {
  if (row.status === 'failure') {
    return 'SKIP';
  }

  if (row[BULK_EDIT_NEW_ROW_KEY]) {
    return 'CREATE';
  }

  if (changedKeys.length === 0) {
    return 'NO_CHANGE';
  }

  return getBulkEditRowName(row) !== getBulkEditRowName(originalRow)
    ? 'CREATE'
    : 'UPDATE';
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
  const [searchText, setSearchText] = useState('');
  const [highlightedRowId, setHighlightedRowId] = useState<string>();
  const gridWrapperRef = useRef<HTMLDivElement | null>(null);
  const setGridRef = useCallback(
    (node: HTMLElement | null) => {
      gridWrapperRef.current = node as HTMLDivElement | null;
      setGridContainer(node);
    },
    [setGridContainer]
  );

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

  const newRowSeqRef = useRef(0);
  const isMetricEntity = entityType === EntityType.METRIC;

  const handleAddMetric = useCallback(() => {
    const blankRow: Record<string, string> = {};
    columns.forEach((col) => {
      blankRow[col.key] = '';
    });
    const enumDefaults: Record<string, string> = {
      metricType: 'COUNT',
      unitOfMeasurement: 'COUNT',
      granularity: 'DAY',
      expressionLanguage: 'SQL',
    };
    Object.entries(enumDefaults).forEach(([key, value]) => {
      if (key in blankRow) {
        blankRow[key] = value;
      }
    });
    newRowSeqRef.current += 1;
    const newRowId = `new-${newRowSeqRef.current}`;
    blankRow.id = newRowId;
    blankRow[BULK_EDIT_NEW_ROW_KEY] = 'true';

    handleOnRowsChange([...dataSource, blankRow]);
    setHighlightedRowId(newRowId);
    // Scroll the new row into view, then flash it briefly (design parity).
    window.setTimeout(() => {
      const grid = gridWrapperRef.current?.querySelector('.rdg');
      if (grid) {
        grid.scrollTop = grid.scrollHeight;
      }
    }, 60);
    window.setTimeout(
      () => setHighlightedRowId((id) => (id === newRowId ? undefined : id)),
      2000
    );
  }, [columns, dataSource, handleOnRowsChange]);

  const handleRemoveRow = useCallback(
    (rowId: string) => {
      handleOnRowsChange(dataSource.filter((row) => row.id !== rowId));
    },
    [dataSource, handleOnRowsChange]
  );

  useEffect(() => {
    // Loads the grid via a synchronous export (no Jobs-tray job is created).
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

  const filteredDataSource = useMemo(() => {
    const search = searchText.trim().toLowerCase();
    if (!search) {
      return dataSource;
    }

    return dataSource.filter((row) => {
      const haystack = [
        row.name,
        row['name*'],
        row.displayName,
        row['displayName*'],
        row.description,
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());

      return haystack.some((value) => value.includes(search));
    });
  }, [dataSource, searchText]);

  // Look up the original (pre-edit) row by its stable id so operation
  // classification and the rename hint never depend on array position.
  const initialRowById = useMemo(
    () => new Map(initialDataSource.map((row) => [row.id, row])),
    [initialDataSource]
  );

  /*
    Owner dropdown uses <ProfilePicture /> which uses useUserProfile hook
    useUserProfile hook uses useApplicationStore hook
    Updating store will trigger re-render of the component
    This will cause the owner dropdown or full grid to re-render
  */
  const editDataGrid = useMemo(() => {
    const dataSourceWithOperations: Record<string, string>[] =
      filteredDataSource.map((row, index) => {
        const rowId = row.id ?? `${index}`;
        const originalRow = initialRowById.get(row.id);
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
        <>
          <OperationBadge
            currentName={getBulkEditRowName(row)}
            operation={
              (row[BULK_EDIT_OPERATION_KEY] as BulkActionOperation) ??
              'NO_CHANGE'
            }
            originalName={row[BULK_EDIT_ORIGINAL_NAME_KEY] ?? ''}
          />
          {row[BULK_EDIT_NEW_ROW_KEY] && (
            <button
              className="bulk-edit-remove-row"
              data-testid="bulk-edit-remove-row"
              type="button"
              onClick={() => handleRemoveRow(row.id ?? '')}>
              <Trash01 size={12} />
              {t('label.remove')}
            </button>
          )}
        </>
      ),
    };
    const gridColumns = [
      operationColumn,
      ...(columns as unknown as Column<Record<string, string>>[]).filter(
        (column) => column.key !== 'operation'
      ),
    ].map((column) => {
      const baseCellClass = column.cellClass;
      const baseRenderCell = column.renderCell;
      const columnKey = column.key.replace('*', '');
      const columnWidth = BULK_EDIT_COLUMN_WIDTHS[columnKey];
      // The Name column is locked for existing metrics but editable for rows
      // added via "Add metric" (you're creating the record).
      const isNameColumn = columnKey === 'name';

      return {
        ...column,
        minWidth: columnWidth ?? column.minWidth,
        width: columnWidth ?? column.width,
        editable: isNameColumn
          ? (row: Record<string, string>) => Boolean(row[BULK_EDIT_NEW_ROW_KEY])
          : column.editable,
        // Locked existing-metric Name cells show a lock icon (design parity);
        // "Add metric" rows keep the plain editable name renderer.
        renderCell: isNameColumn
          ? (props: RenderCellProps<Record<string, string>>) =>
              props.row[BULK_EDIT_NEW_ROW_KEY] ? (
                baseRenderCell?.(props)
              ) : (
                <div className="bulk-edit-name-cell">
                  <span className="bulk-edit-name-value">
                    {baseRenderCell?.(props)}
                  </span>
                  <Lock01 className="bulk-edit-name-lock" size={14} />
                </div>
              )
          : column.renderCell,
        cellClass: (row: Record<string, string>) => {
          const defaultClass =
            typeof baseCellClass === 'function'
              ? baseCellClass(row as never)
              : baseCellClass;
          const rowId = row.id ?? '';
          const isEdited = changedCellKeysByRowId[rowId]?.includes(column.key);
          // Existing metric Name cells are locked (greyed) — their name is the
          // identity and can't change; only "Add metric" rows unlock the Name.
          // (The base cellClass omits rdg-cell-locked because the CSV header is
          // "name*", so add/strip it explicitly here.)
          const isNameLocked = isNameColumn && !row[BULK_EDIT_NEW_ROW_KEY];
          const baseClassName = String(defaultClass ?? '').replace(
            'rdg-cell-locked',
            ''
          );
          const resolvedClass = isNameLocked
            ? `${baseClassName} rdg-cell-locked`
            : baseClassName;

          return [resolvedClass, isEdited ? 'rdg-cell-edited' : '']
            .filter(Boolean)
            .join(' ');
        },
      };
    });

    return (
      <div className="om-rdg bulk-edit-rdg" ref={setGridRef}>
        <LazyDataGrid
          className="rdg-light"
          columns={
            gridColumns as unknown as ColumnOrColumnGroup<
              NoInfer<Record<string, string>>,
              unknown
            >[]
          }
          headerRowHeight={38}
          rowClass={(row: Record<string, string>) => {
            const operationClass = `bulk-edit-op-row-${String(
              row[BULK_EDIT_OPERATION_KEY] ?? 'NO_CHANGE'
            ).toLowerCase()}`;

            return row.id === highlightedRowId
              ? `${operationClass} bulk-edit-row-highlight`
              : operationClass;
          }}
          rowHeight={52}
          rows={dataSourceWithOperations}
          onCellClick={(args: CellClickArgs<Record<string, string>>) => {
            args.selectCell(true);
          }}
          onCopy={handleCopy}
          onPaste={handlePaste}
          onRowsChange={handleOnRowsChange}
        />
      </div>
    );
  }, [
    changedCellKeysByRowId,
    columns,
    filteredDataSource,
    handleCopy,
    handlePaste,
    handleOnRowsChange,
    handleRemoveRow,
    highlightedRowId,
    initialRowById,
    setGridRef,
    t,
  ]);

  const operationSummary = useMemo(() => {
    return dataSource.reduce(
      (summary, row, index) => {
        const rowId = row.id ?? `${index}`;
        const operation = getBulkEditOperation(
          row,
          initialRowById.get(row.id),
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
      } as Record<BulkActionOperation, number>
    );
  }, [changedCellKeysByRowId, dataSource, initialRowById]);

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
                  <div className="bulk-edit-toolbar">
                    <OperationSummary summary={operationSummary} />
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
                    <div className="bulk-edit-toolbar-actions">
                      <Input
                        className="bulk-edit-search"
                        data-testid="bulk-edit-search"
                        icon={SearchLg}
                        placeholder={t('label.search-entity', {
                          entity: `${
                            dataSource.length
                          } ${entityPluralDisplayName.toLowerCase()}`,
                        })}
                        value={searchText}
                        wrapperClassName="bulk-edit-search-wrapper"
                        onChange={setSearchText}
                      />
                      <Button
                        color="secondary"
                        iconLeading={RefreshCcw01}
                        onPress={handleRevertChanges}>
                        {t('label.revert-changes')}
                      </Button>
                    </div>
                  </div>
                  <div className="bulk-edit-grid-shell">{editDataGrid}</div>
                  {isMetricEntity && (
                    <div className="bulk-edit-add-row-bar">
                      <Button
                        className="bulk-edit-add-row-btn"
                        color="secondary"
                        data-testid="bulk-edit-add-metric"
                        iconLeading={Plus}
                        onPress={handleAddMetric}>
                        {t('label.add-entity', {
                          entity: t('label.metric'),
                        })}
                      </Button>
                      <span className="bulk-edit-add-row-hint">
                        {t('message.bulk-edit-add-metric-hint')}
                      </span>
                    </div>
                  )}
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
