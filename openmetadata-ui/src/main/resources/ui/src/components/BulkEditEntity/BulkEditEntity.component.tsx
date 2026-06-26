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
  XCircle,
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
import entityBulkEditConfigClassBase from '../../utils/CSV/EntityBulkEditConfigClassBase';
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
  name: 200,
  displayName: 220,
  description: 420,
  metricType: 140,
  unitOfMeasurement: 180,
  customUnitOfMeasurement: 160,
};

const BULK_EDIT_OPERATION_KEY = '__bulkEditOperation';
const BULK_EDIT_ORIGINAL_NAME_KEY = '__bulkEditOriginalName';

// Plain-text columns select on single click and enter edit mode on typing or
// Enter (standard spreadsheet behaviour). Picker/dropdown columns open their
// editor on a single click. Opening a text editor on the first click conflicts
// with keyboard-driven edit flows that press Enter to begin editing — the Enter
// would instead commit-and-close the just-opened editor.
const SELECT_ONLY_ON_CLICK_COLUMNS = new Set([
  'name',
  'displayName',
  'description',
]);

const getBulkEditRowName = (row?: Record<string, string>) =>
  String(row?.name ?? row?.['name*'] ?? '');

const BULK_EDIT_NEW_ROW_KEY = '__bulkEditNewRow';

const isNewMetricRowMissingName = (row: Record<string, string>) =>
  Boolean(row[BULK_EDIT_NEW_ROW_KEY]) && !getBulkEditRowName(row).trim();

const getBulkEditOperation = (
  row: Record<string, string>,
  originalRow: Record<string, string> | undefined,
  changedKeys: string[],
  workflowMode: BulkEditEntityProps['workflowMode']
): BulkActionOperation => {
  if (row.status === 'failure') {
    return 'SKIP';
  }

  if (isNewMetricRowMissingName(row)) {
    return 'SKIP';
  }

  if (workflowMode === 'import') {
    return getBulkEditRowName(row).trim() ? 'CREATE' : 'SKIP';
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
  isExportHydrationRequired = true,
  isLoadingSourceData = false,
  isNextDisabled,
  onCSVReadComplete,
  setGridContainer,
  handleCopy,
  handlePaste,
  handleOnRowsChange,
  handleRevertChanges,
  sourceEntityType,
  workflowHeaderConfig,
  workflowMode = 'bulkEdit',
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
    if (isExportHydrationRequired) {
      clearCSVExportData();
    }
    navigate(getBulkEntityNavigationPath(entityType, fqn, sourceEntityType));
  };

  const newRowSeqRef = useRef(0);
  const bulkEditConfig = entityBulkEditConfigClassBase.getConfig(entityType);
  const isRichGridEntity = Boolean(bulkEditConfig?.richGrid);
  const newRowConfig = bulkEditConfig?.newRow;
  const isImportWorkflow = workflowMode === 'import';
  const shouldDisableNext =
    isValidating || (isNextDisabled ?? changedCellCount === 0);

  const handleAddRow = useCallback(() => {
    const blankRow: Record<string, string> = {};
    columns.forEach((col) => {
      blankRow[col.key] = '';
    });
    Object.entries(newRowConfig?.defaults ?? {}).forEach(([key, value]) => {
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

  // Hydrate the grid from a single export per entity. The ref guard keeps this
  // idempotent so a re-run of the effect (React StrictMode in dev, or a
  // provider value identity change) cannot spawn duplicate export jobs.
  const triggeredExportKeyRef = useRef<string>();

  useEffect(() => {
    if (!isExportHydrationRequired) {
      return;
    }

    const exportKey = `${entityType}:${fqn}`;
    if (triggeredExportKeyRef.current === exportKey) {
      return;
    }
    triggeredExportKeyRef.current = exportKey;

    triggerExportForBulkEdit({
      name: fqn,
      onExport: getBulkEditCSVExportEntityApi(entityType),
      exportTypes: [ExportTypes.CSV],
      onError: () => {
        // Clear the guard so a failed hydration export can be retried.
        triggeredExportKeyRef.current = undefined;
      },
    });
  }, [entityType, fqn, isExportHydrationRequired, triggerExportForBulkEdit]);

  // Re-parses csvExportData into the grid exactly once per value. Without
  // this guard, onCSVReadComplete's identity churns whenever any of its own
  // dependencies (e.g. entity rules resolving asynchronously after mount)
  // gets a new reference, re-running this effect and silently overwriting
  // any edits the user has already made to the grid.
  const parsedCsvExportDataRef = useRef<string>();

  useEffect(() => {
    if (
      isExportHydrationRequired &&
      csvExportData &&
      parsedCsvExportDataRef.current !== csvExportData
    ) {
      parsedCsvExportDataRef.current = csvExportData;
      readString(csvExportData, {
        worker: true,
        skipEmptyLines: true,
        complete: onCSVReadComplete,
      });
    }
  }, [csvExportData, isExportHydrationRequired, onCSVReadComplete]);

  useEffect(() => {
    return () => {
      if (isExportHydrationRequired) {
        clearCSVExportData();
      }
    };
  }, [clearCSVExportData, isExportHydrationRequired]);

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
          changedCellKeysByRowId[rowId] ?? [],
          workflowMode
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
      const columnKey = column.key.replaceAll('*', '');
      const columnWidth = BULK_EDIT_COLUMN_WIDTHS[columnKey];
      const isNameColumn = columnKey === 'name';
      const shouldLockNameColumn =
        !isImportWorkflow &&
        Boolean(bulkEditConfig?.lockedColumns.includes(columnKey));

      return {
        ...column,
        minWidth: columnWidth ?? column.minWidth,
        width: columnWidth ?? column.width,
        frozen: isNameColumn ? true : column.frozen,
        editable: shouldLockNameColumn
          ? (row: Record<string, string>) => Boolean(row[BULK_EDIT_NEW_ROW_KEY])
          : column.editable,
        renderCell: shouldLockNameColumn
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
          const isNameLocked =
            shouldLockNameColumn && !row[BULK_EDIT_NEW_ROW_KEY];
          const isRequiredNameMissing =
            isNameColumn && isNewMetricRowMissingName(row);
          const baseClassName = String(defaultClass ?? '').replace(
            'rdg-cell-locked',
            ''
          );
          const resolvedClass = isNameLocked
            ? `${baseClassName} rdg-cell-locked`
            : baseClassName;

          return [
            resolvedClass,
            isEdited ? 'rdg-cell-edited' : '',
            isRequiredNameMissing ? 'rdg-cell-required-error' : '',
          ]
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
              ? `${operationClass}${
                  isNewMetricRowMissingName(row)
                    ? ''
                    : ' bulk-edit-row-highlight'
                }`
              : operationClass;
          }}
          rowHeight={52}
          rows={dataSourceWithOperations}
          onCellClick={(args: CellClickArgs<Record<string, string>>) => {
            const colType = (args.column.key.split('.').pop() ?? '').replace(
              /\*$/,
              ''
            );

            args.selectCell(!SELECT_ONLY_ON_CLICK_COLUMNS.has(colType));
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
    isImportWorkflow,
    bulkEditConfig,
    setGridRef,
    t,
    workflowMode,
  ]);

  const operationSummary = useMemo(() => {
    return dataSource.reduce(
      (summary, row, index) => {
        const rowId = row.id ?? `${index}`;
        const operation = getBulkEditOperation(
          row,
          initialRowById.get(row.id),
          changedCellKeysByRowId[rowId] ?? [],
          workflowMode
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
  }, [changedCellKeysByRowId, dataSource, initialRowById, workflowMode]);

  const invalidNewMetricRowCount = useMemo(
    () => dataSource.filter(isNewMetricRowMissingName).length,
    [dataSource]
  );

  return (
    <>
      <CsvWorkflowHeader
        activeStep={activeStep}
        breadcrumbList={breadcrumbList}
        currentLabel={
          workflowHeaderConfig?.currentLabel ?? t('label.bulk-edit')
        }
        description={
          workflowHeaderConfig?.description ??
          t('message.bulk-edit-inline-help')
        }
        steps={workflowHeaderConfig?.steps ?? translatedSteps}
        title={
          workflowHeaderConfig?.title ??
          `${t('label.edit')} ${
            dataSource.length
          } ${entityPluralDisplayName.toLowerCase()}`
        }
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

      {(isExportHydrationRequired && isEmpty(csvExportData)) ||
      isLoadingSourceData ? (
        <Loader />
      ) : (
        <>
          <div>
            {activeStep === 1 && (
              <div className="csv-import-card bulk-edit-card">
                <div className="csv-import-stack bulk-edit-stack">
                  <div className="bulk-edit-toolbar">
                    {isImportWorkflow && validationData ? (
                      <ImportStatus csvImportResult={validationData} />
                    ) : (
                      <OperationSummary summary={operationSummary} />
                    )}
                    {invalidNewMetricRowCount > 0 && (
                      <BadgeWithIcon
                        className="bulk-edit-error-pill"
                        color="error"
                        iconLeading={XCircle}
                        size="sm"
                        type="pill-color">
                        {`${invalidNewMetricRowCount} ${t(
                          invalidNewMetricRowCount === 1
                            ? 'label.error'
                            : 'label.error-plural'
                        ).toLowerCase()}`}
                      </BadgeWithIcon>
                    )}
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
                        // role searchbox (not textbox) so it does not collide
                        // with the grid cell text editors when tests/automation
                        // resolve the active editor via getByRole('textbox').
                        type="search"
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
                  {newRowConfig && (
                    <div className="bulk-edit-add-row-bar">
                      <div className="bulk-edit-add-row-content">
                        <Button
                          className="bulk-edit-add-row-btn"
                          color="secondary"
                          data-testid="bulk-edit-add-metric"
                          iconLeading={Plus}
                          onPress={handleAddRow}>
                          {isImportWorkflow
                            ? t('label.add-row')
                            : t('label.add-entity', {
                                entity: t(newRowConfig.entityLabelKey),
                              })}
                        </Button>
                        {!isImportWorkflow && (
                          <span className="bulk-edit-add-row-hint">
                            {t(newRowConfig.hintMessageKey)}
                          </span>
                        )}
                      </div>
                      <div className="bulk-edit-add-row-actions">
                        <Button
                          color="secondary"
                          isDisabled={isValidating}
                          onPress={handleCancel}>
                          {t('label.cancel')}
                        </Button>
                        <Button
                          color="primary"
                          isDisabled={shouldDisableNext}
                          onPress={handleValidate}>
                          {isImportWorkflow
                            ? `${t('label.start')} ${t('label.import')}`
                            : t('label.next')}
                        </Button>
                      </div>
                    </div>
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
          {activeStep > 0 && !(activeStep === 1 && isRichGridEntity) && (
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
                      isValidating || (activeStep === 1 && shouldDisableNext)
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
