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
  Alert,
  Badge,
  Button,
  Dialog,
  Modal,
  ModalOverlay,
  ProgressBar,
} from '@openmetadata/ui-core-components';
import {
  CheckCircle,
  ChevronRight,
  Download01,
  File06,
  FilterLines,
  Plus,
  RefreshCcw01,
  RefreshCw01,
  StopCircle,
  XClose,
} from '@untitledui/icons';
import type { RcFile } from 'antd/lib/upload';
import { AxiosError } from 'axios';
import { capitalize, isEmpty, startCase } from 'lodash';
import { unparse } from 'papaparse';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  Column,
  ColumnOrColumnGroup,
  RenderCellProps,
} from 'react-data-grid';
import { useTranslation } from 'react-i18next';
import { usePapaParse } from 'react-papaparse';
import { useLocation, useNavigate } from 'react-router-dom';
import BulkEditEntity from '../../../components/BulkEditEntity/BulkEditEntity.component';
import Banner from '../../../components/common/Banner/Banner';
import { LazyDataGrid } from '../../../components/common/DataGrid/LazyDataGrid';
import { CSV_JOBS_REFRESH_EVENT } from '../../../components/common/EntityImport/CsvJobsTray/CsvJobsTray.constants';
import CsvWorkflowHeader from '../../../components/common/EntityImport/CsvWorkflowHeader/CsvWorkflowHeader.component';
import { ImportStatus } from '../../../components/common/EntityImport/ImportStatus/ImportStatus.component';
import {
  OperationBadge,
  OperationSummary,
} from '../../../components/common/EntityImport/OperationCell/OperationCell.component';
import { TitleBreadcrumbProps } from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import { DataAssetsHeaderProps } from '../../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { ProfilerTabPath } from '../../../components/Database/Profiler/ProfilerDashboard/profilerDashboard.interface';
import PageLayoutV1 from '../../../components/PageLayoutV1/PageLayoutV1';
import UploadFile from '../../../components/UploadFile/UploadFile';
import {
  ENTITY_IMPORT_STEPS,
  VALIDATION_STEP,
} from '../../../constants/BulkImport.constant';
import { WILD_CARD_CHAR } from '../../../constants/char.constants';
import { ROUTES, SOCKET_EVENTS } from '../../../constants/constants';
import { useWebSocketConnector } from '../../../context/WebSocketProvider/WebSocketProvider';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { CSVImportResult } from '../../../generated/type/csvImportResult';
import { useEntityRules } from '../../../hooks/useEntityRules';
import { useFqn } from '../../../hooks/useFqn';
import { useGridEditController } from '../../../hooks/useGridEditController';
import {
  cancelCsvAsyncJob,
  CsvAsyncJob,
  CsvDocumentation,
  getCsvAsyncJobs,
  getCsvDocumentation,
} from '../../../rest/csvAPI';
import {
  getCsvHeaderKey,
  getEntityColumnsAndDataSourceFromCSV,
  getImportOperation,
  getImportOperationRowClass,
  getImportOperationSummary,
  IMPORT_OPERATIONS,
  IMPORT_OPERATION_COLUMN_KEY,
  isMetricBulkEditHiddenColumn,
} from '../../../utils/CSV/CSV.utils';
import {
  COLUMNS_WIDTH,
  getCSVStringFromColumnsAndDataSource,
} from '../../../utils/CSV/CSVPureUtils';
import csvUtilsClassBase from '../../../utils/CSV/CSVUtilsClassBase';
import entityBulkEditConfigClassBase, {
  BulkEditListingScope,
} from '../../../utils/CSV/EntityBulkEditConfigClassBase';
import {
  getBulkEntityNavigationPath,
  isBulkEditRoute,
} from '../../../utils/EntityBulkEdit/EntityBulkEditUtils';
import {
  getBulkEntityBreadcrumbList,
  getImportedEntityType,
  getImportValidateAPIEntityType,
  validateCsvString,
} from '../../../utils/EntityImport/EntityImportUtils';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import { downloadFile } from '../../../utils/Export/ExportUtils';
import observabilityRouterClassBase from '../../../utils/ObservabilityRouterClassBase';
import {
  getEntityDetailsPath,
  getTestSuitePath,
} from '../../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import { DataQualityPageTabs } from '../../DataQuality/DataQualityPage.interface';
import './bulk-entity-import-page.less';
import {
  BulkEntityImportLocationState,
  CSVImportAsyncWebsocketResponse,
  CSVImportJobType,
} from './BulkEntityImportPage.interface';

interface SelectedCsvFile {
  content: string;
  name: string;
  rowCount: number;
  sizeLabel: string;
}

type CsvProcessingStage = 'done' | 'active' | 'pending';

const CSV_FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB'];

const getCsvRowCount = (content: string) =>
  content.split(/\r\n|\n|\r/).filter((line, index) => index > 0 && line.trim())
    .length;

const getCsvFileSizeLabel = (bytes = 0) => {
  if (!bytes) {
    return `0 ${CSV_FILE_SIZE_UNITS[0]}`;
  }

  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    CSV_FILE_SIZE_UNITS.length - 1
  );
  const normalizedSize = bytes / 1024 ** unitIndex;

  return `${normalizedSize.toFixed(unitIndex === 0 ? 0 : 1)} ${
    CSV_FILE_SIZE_UNITS[unitIndex]
  }`;
};

const BulkEntityImportPage = () => {
  const location = useLocation();
  const { socket } = useWebSocketConnector();
  const [activeAsyncImportJob, setActiveAsyncImportJob] =
    useState<CSVImportJobType>();
  const activeAsyncImportJobRef = useRef<CSVImportJobType>();
  // This ref is used to track the bulk action processing for the Current/Active Page or Tab
  const isBulkActionProcessingRef = useRef<{
    isProcessing: boolean;
    entityType?: EntityType;
  }>({
    isProcessing: false,
    entityType: undefined,
  });

  const sourceEntityTypeFromURL = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const sourceType = params.get('sourceEntityType');

    return sourceType === EntityType.TABLE ||
      sourceType === EntityType.TEST_SUITE
      ? sourceType
      : undefined;
  }, [location.search]);

  const routeState = useMemo(
    () => location.state as BulkEntityImportLocationState | null,
    [location.state]
  );

  const metricBulkEditScope = routeState?.metricBulkEditScope;
  const selectedMetricNamesForBulkEdit = useMemo(
    () => routeState?.selectedMetricNames ?? [],
    [routeState]
  );

  const [activeStep, setActiveStep] = useState<VALIDATION_STEP>(
    VALIDATION_STEP.UPLOAD
  );
  const activeStepRef = useRef<VALIDATION_STEP>(VALIDATION_STEP.UPLOAD);
  const { t } = useTranslation();
  const { entityType } = useRequiredParams<{ entityType: EntityType }>();
  const { fqn } = useFqn();
  const [isValidating, setIsValidating] = useState(false);
  const { entityRules } = useEntityRules(entityType);
  const canAddMultipleUserOwners = entityRules.canAddMultipleUserOwners;
  const canAddMultipleTeamOwner = entityRules.canAddMultipleTeamOwner;

  const translatedSteps = useMemo(
    () =>
      ENTITY_IMPORT_STEPS.map((step) => ({
        ...step,
        name: startCase(t(step.name)),
      })),
    [t]
  );
  const [validationData, setValidationData] = useState<CSVImportResult>();
  const [columns, setColumns] = useState<Column<Record<string, string>>[]>([]);
  const [dataSource, setDataSource] = useState<Record<string, string>[]>([]);
  const navigate = useNavigate();
  const { readString } = usePapaParse();
  const [validateCSVData, setValidateCSVData] = useState<{
    columns: Column<Record<string, string>>[];
    dataSource: Record<string, string>[];
  }>();

  const [entity, setEntity] = useState<DataAssetsHeaderProps['dataAsset']>();
  const [sourceEntityType, setSourceEntityType] = useState<EntityType>();
  const [csvDocumentation, setCsvDocumentation] = useState<CsvDocumentation>();
  const [isColumnReferenceOpen, setIsColumnReferenceOpen] = useState(false);
  const [rowFilter, setRowFilter] = useState<'all' | 'failed'>('all');
  const [initialDataSource, setInitialDataSource] = useState<
    Record<string, string>[]
  >([]);
  const [csvJobs, setCsvJobs] = useState<CsvAsyncJob[]>([]);
  const [isCancellingJob, setIsCancellingJob] = useState(false);
  const [selectedCsvFile, setSelectedCsvFile] = useState<SelectedCsvFile>();
  const [activeImportLogLines, setActiveImportLogLines] = useState<string[]>(
    []
  );
  const [bulkEditLoadState, setBulkEditLoadState] = useState({
    isLoading: Boolean(metricBulkEditScope),
    loadedCount: 0,
    matchedCount: 0,
  });

  const effectiveSourceEntityType = useMemo(() => {
    return sourceEntityType ?? sourceEntityTypeFromURL;
  }, [sourceEntityType, sourceEntityTypeFromURL]);

  const isBulkEdit = useMemo(
    () => isBulkEditRoute(location.pathname),
    [location]
  );
  const bulkEditConfig = entityBulkEditConfigClassBase.getConfig(entityType);
  const isRichGridImport = !isBulkEdit && Boolean(bulkEditConfig?.richGrid);
  const shouldUseRichEditorGrid = isBulkEdit || isRichGridImport;

  // The router carries the metric-flavored scope shape; the listing pipeline
  // consumes the generic registry shape.
  const effectiveBulkEditScope = useMemo<
    BulkEditListingScope | undefined
  >(() => {
    const supportsListing = Boolean(
      bulkEditConfig?.fetchBulkEditGridFromListing
    );
    if (!supportsListing || !isBulkEdit || fqn !== WILD_CARD_CHAR) {
      return undefined;
    }

    if (metricBulkEditScope) {
      return metricBulkEditScope.mode === 'selected'
        ? {
            mode: 'selected',
            ids: metricBulkEditScope.metricIds,
            names: metricBulkEditScope.metricNames,
            filters: metricBulkEditScope.filters,
          }
        : { mode: 'filtered', filters: metricBulkEditScope.filters };
    }

    return { mode: 'filtered', filters: {} };
  }, [bulkEditConfig, fqn, isBulkEdit, metricBulkEditScope]);

  const isListingBulkEdit = Boolean(effectiveBulkEditScope);
  const importUploadConfig = bulkEditConfig?.importUpload;

  const importedEntityType = useMemo(
    () => getImportedEntityType(entityType),
    [entityType]
  );

  const shouldShowCsvColumn = useCallback(
    (columnKey: string) =>
      !csvUtilsClassBase.hideImportsColumnList().includes(columnKey) &&
      !isMetricBulkEditHiddenColumn(
        columnKey,
        importedEntityType,
        shouldUseRichEditorGrid
      ),
    [importedEntityType, shouldUseRichEditorGrid]
  );

  const filterColumns = useMemo(
    () => columns?.filter((col) => shouldShowCsvColumn(col.key ?? '')),
    [columns, shouldShowCsvColumn]
  );

  const {
    handleCopy,
    handlePaste: actualHandlePaste,
    pushToUndoStack,
    handleOnRowsChange,
    setGridContainer,
    handleAddRow,
  } = useGridEditController({
    dataSource,
    setDataSource,
    columns: filterColumns,
  });

  const bulkEditChangeSummary = useMemo(() => {
    const editableColumnKeys = filterColumns
      .filter((column) => column.editable)
      .map((column) => column.key);
    // Diff against the original row by its stable id, not its array index, so
    // adding/reordering rows can never misalign the changed-cell diff sent to
    // the server.
    const initialRowById = new Map(
      initialDataSource.map((row) => [row.id, row])
    );
    const changedCellKeysByRowId: Record<string, string[]> = {};
    const changedDataSource: Record<string, string>[] = [];
    let changedCellCount = 0;

    dataSource.forEach((row, index) => {
      const initialRow = initialRowById.get(row.id) ?? {};
      const changedKeys = editableColumnKeys.filter(
        (key) => String(row[key] ?? '') !== String(initialRow[key] ?? '')
      );

      if (changedKeys.length) {
        changedCellKeysByRowId[row.id ?? `${index}`] = changedKeys;
        changedCellCount += changedKeys.length;
        changedDataSource.push(row);
      }
    });

    return {
      changedCellCount,
      changedCellKeysByRowId,
      changedDataSource,
      changedRowCount: changedDataSource.length,
    };
  }, [dataSource, filterColumns, initialDataSource]);

  const handlePaste = actualHandlePaste as unknown as () => Record<
    string,
    string
  >;

  const fetchEntityData = useCallback(async () => {
    if (fqn === WILD_CARD_CHAR) {
      setEntity(undefined);
      setSourceEntityType(undefined);

      return;
    }

    if (entityType === EntityType.TEST_CASE) {
      if (sourceEntityTypeFromURL) {
        try {
          const response = await entityUtilClassBase.getEntityByFqn(
            sourceEntityTypeFromURL,
            fqn
          );
          setEntity(response as DataAssetsHeaderProps['dataAsset']);
          setSourceEntityType(sourceEntityTypeFromURL);
        } catch (error) {
          showErrorToast(
            error as AxiosError,
            t('message.entity-fetch-error', { entity: entityType })
          );
        }
      }
    } else {
      try {
        const response = await entityUtilClassBase.getEntityByFqn(
          entityType,
          fqn
        );
        setEntity(response as DataAssetsHeaderProps['dataAsset']);
        setSourceEntityType(entityType);
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('message.entity-fetch-error', { entity: entityType })
        );
      }
    }
  }, [entityType, fqn, t, sourceEntityTypeFromURL]);

  const breadcrumbList: TitleBreadcrumbProps['titleLinks'] = useMemo(() => {
    if (fqn === WILD_CARD_CHAR) {
      if (entityType === EntityType.METRIC) {
        return [
          {
            name: t('label.metric-plural'),
            url: ROUTES.METRICS,
          },
        ];
      }

      return [
        {
          name: t('label.data-quality'),
          url: observabilityRouterClassBase.getDataQualityPagePath(
            DataQualityPageTabs.TEST_CASES
          ),
        },
      ];
    }

    if (!entity) {
      return [];
    }

    const breadcrumbEntityType = sourceEntityType ?? entityType;

    if (
      entityType === EntityType.TEST_CASE &&
      breadcrumbEntityType === EntityType.TABLE
    ) {
      const baseBreadcrumb = getBulkEntityBreadcrumbList(
        EntityType.TABLE,
        entity,
        isBulkEdit,
        [
          {
            name: t('label.data-quality'),
            url: getEntityDetailsPath(
              EntityType.TABLE,
              entity.fullyQualifiedName ?? '',
              EntityTabs.PROFILER,
              ProfilerTabPath.DATA_QUALITY
            ),
          },
        ]
      );

      return baseBreadcrumb;
    }

    if (
      entityType === EntityType.TEST_CASE &&
      breadcrumbEntityType === EntityType.TEST_SUITE
    ) {
      return [
        {
          name: t('label.test-suite-plural'),
          url: observabilityRouterClassBase.getDataQualityPagePath(
            DataQualityPageTabs.TEST_SUITES
          ),
        },
        {
          name: entity.displayName ?? entity.name ?? '',
          url: getTestSuitePath(entity.fullyQualifiedName ?? ''),
        },
      ];
    }

    return getBulkEntityBreadcrumbList(
      breadcrumbEntityType,
      entity,
      isBulkEdit
    );
  }, [entityType, entity, isBulkEdit, fqn, sourceEntityType, t]);

  const entityDisplayName = useMemo(
    () =>
      t(`label.${entityType}`, {
        defaultValue: startCase(entityType),
      }),
    [entityType, t]
  );

  const entityPluralDisplayName = useMemo(
    () =>
      t(`label.${entityType}-plural`, {
        defaultValue: startCase(entityType),
      }),
    [entityType, t]
  );

  const requiredCsvHeaders = useMemo(
    () =>
      csvDocumentation?.headers
        ?.filter((header) => Boolean(header.required))
        .map((header) => header.name) ?? [],
    [csvDocumentation]
  );

  const activePersistedJob = useMemo(
    () => csvJobs.find((job) => job.jobId === activeAsyncImportJob?.jobId),
    [csvJobs, activeAsyncImportJob?.jobId]
  );

  const handleActiveStepChange = useCallback(
    (step: VALIDATION_STEP) => {
      setActiveStep(step);
      activeStepRef.current = step;
    },
    [setActiveStep, activeStepRef]
  );

  const handleResetImportJob = useCallback(() => {
    setActiveAsyncImportJob(undefined);
    activeAsyncImportJobRef.current = undefined;
  }, [setActiveAsyncImportJob, activeAsyncImportJobRef]);

  const appendActiveImportLogLine = useCallback((message?: string) => {
    const trimmedMessage = message?.trim();

    if (!trimmedMessage) {
      return;
    }

    setActiveImportLogLines((logs) => {
      if (logs[0] === trimmedMessage) {
        return logs;
      }

      return [trimmedMessage, ...logs].slice(0, 200);
    });
  }, []);

  const fetchCsvJobs = useCallback(async () => {
    try {
      const jobs = await getCsvAsyncJobs();
      setCsvJobs(jobs);
    } catch (error) {
      if ((error as AxiosError).response?.status !== 404) {
        showErrorToast(error as AxiosError);
      }
    }
  }, []);

  const hydrateBulkEditFromListing = useCallback(
    async (signal: AbortSignal) => {
      const fetchGrid = bulkEditConfig?.fetchBulkEditGridFromListing;
      if (
        !fetchGrid ||
        !effectiveBulkEditScope ||
        !csvDocumentation?.headers.length
      ) {
        return;
      }

      setBulkEditLoadState({
        isLoading: true,
        loadedCount: 0,
        matchedCount: 0,
      });

      const grid = await fetchGrid({
        scope: effectiveBulkEditScope,
        headers: csvDocumentation.headers,
        multipleOwner: {
          user: canAddMultipleUserOwners,
          team: canAddMultipleTeamOwner,
        },
        isBulkEdit,
        signal,
        onProgress: (loadedCount, matchedCount) =>
          setBulkEditLoadState({
            isLoading: true,
            loadedCount,
            matchedCount,
          }),
      });

      if (signal.aborted) {
        return;
      }

      setColumns(grid.columns);
      setDataSource(grid.dataSource);
      setInitialDataSource(grid.dataSource.map((row) => ({ ...row })));
      setBulkEditLoadState({
        isLoading: false,
        loadedCount: grid.loadedCount,
        matchedCount: grid.matchedCount,
      });
      handleActiveStepChange(VALIDATION_STEP.EDIT_VALIDATE);
    },
    [
      bulkEditConfig,
      csvDocumentation,
      canAddMultipleTeamOwner,
      canAddMultipleUserOwners,
      handleActiveStepChange,
      isBulkEdit,
      effectiveBulkEditScope,
    ]
  );

  const handleDownloadTemplate = useCallback(() => {
    if (!csvDocumentation?.headers?.length) {
      return;
    }

    const fields = csvDocumentation.headers.map(getCsvHeaderKey);
    const exampleRow = csvDocumentation.headers.reduce<Record<string, string>>(
      (acc, header) => {
        acc[getCsvHeaderKey(header)] = header.examples?.[0] ?? '';

        return acc;
      },
      {}
    );

    downloadFile(unparse({ fields, data: [exampleRow] }), `${entityType}.csv`);
  }, [csvDocumentation, entityType]);

  const handleRevertChanges = useCallback(() => {
    setDataSource(initialDataSource.map((row) => ({ ...row })));
  }, [initialDataSource]);

  const handleRunInBackground = useCallback(() => {
    navigate(
      getBulkEntityNavigationPath(entityType, fqn, effectiveSourceEntityType)
    );
  }, [entityType, fqn, effectiveSourceEntityType, navigate]);

  const handleCancelActiveJob = useCallback(async () => {
    if (!activeAsyncImportJobRef.current?.jobId) {
      return;
    }

    try {
      setIsCancellingJob(true);
      const job = await cancelCsvAsyncJob(
        activeAsyncImportJobRef.current.jobId
      );
      setCsvJobs((jobs) =>
        jobs.map((item) => (item.jobId === job.jobId ? job : item))
      );
      setActiveAsyncImportJob((currentJob) =>
        currentJob
          ? {
              ...currentJob,
              message: job.message,
              status: job.status === 'CANCELLING' ? 'IN_PROGRESS' : 'FAILED',
            }
          : currentJob
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsCancellingJob(false);
    }
  }, []);

  const onCSVReadComplete = useCallback(
    (results: { data: string[][] }) => {
      // results.data is returning data with unknown type
      const cellEditable = true;
      const { columns, dataSource } = getEntityColumnsAndDataSourceFromCSV(
        results.data as string[][],
        importedEntityType,
        {
          user: entityRules.canAddMultipleUserOwners,
          team: entityRules.canAddMultipleTeamOwner,
        },
        cellEditable,
        isBulkEdit,
        shouldUseRichEditorGrid
      );

      const filteredDataSource =
        isBulkEdit && selectedMetricNamesForBulkEdit.length
          ? dataSource.filter((row) =>
              selectedMetricNamesForBulkEdit.includes(row.name ?? row['name*'])
            )
          : dataSource;

      setDataSource(filteredDataSource);
      setInitialDataSource(filteredDataSource);
      setColumns(columns);

      handleActiveStepChange(VALIDATION_STEP.EDIT_VALIDATE);
    },
    [
      entityType,
      handleActiveStepChange,
      importedEntityType,
      isBulkEdit,
      entityRules,
      selectedMetricNamesForBulkEdit,
      setColumns,
      setDataSource,
      shouldUseRichEditorGrid,
    ]
  );

  const handleLoadData = useCallback(
    (e: ProgressEvent<FileReader>, file?: RcFile) => {
      const result = String(e.target?.result ?? '');

      setSelectedCsvFile({
        content: result,
        name: file?.name ?? t('label.csv'),
        rowCount: getCsvRowCount(result),
        sizeLabel: getCsvFileSizeLabel(file?.size),
      });
      setValidationData(undefined);
      setValidateCSVData(undefined);
      setActiveImportLogLines([]);
      handleResetImportJob();
    },
    [handleResetImportJob, t]
  );

  const handleStartPreview = useCallback(async () => {
    if (!selectedCsvFile) {
      return;
    }

    try {
      setIsValidating(true);
      setActiveImportLogLines([t('message.import-csv-reading-file')]);
      isBulkActionProcessingRef.current = {
        isProcessing: true,
        entityType,
      };

      const initialLoadJobData: CSVImportJobType = {
        type: 'initialLoad',
        initialResult: selectedCsvFile.content,
        message: t('message.import-csv-reading-file'),
      };

      setActiveAsyncImportJob(initialLoadJobData);
      activeAsyncImportJobRef.current = initialLoadJobData;
      // Activate the lazily mounted background-jobs tray so import progress
      // surfaces there even if the user navigates away from this page.
      window.dispatchEvent(new Event(CSV_JOBS_REFRESH_EVENT));

      await validateCsvString(
        selectedCsvFile.content,
        entityType,
        fqn,
        isBulkEdit,
        effectiveSourceEntityType
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
      setIsValidating(false);
      handleResetImportJob();
    }
  }, [
    effectiveSourceEntityType,
    entityType,
    fqn,
    handleResetImportJob,
    isBulkEdit,
    selectedCsvFile,
    t,
  ]);

  const handleBack = () => {
    if (activeStep === VALIDATION_STEP.UPDATE) {
      handleActiveStepChange(VALIDATION_STEP.EDIT_VALIDATE);
    } else {
      handleActiveStepChange(VALIDATION_STEP.UPLOAD);
    }
  };

  const handleValidate = async () => {
    setIsValidating(true);
    setValidateCSVData(undefined);
    try {
      // Call the validate API
      if (isBulkEdit && bulkEditChangeSummary.changedCellCount === 0) {
        setIsValidating(false);

        return;
      }

      const csvData = getCSVStringFromColumnsAndDataSource(
        columns,
        isBulkEdit ? bulkEditChangeSummary.changedDataSource : dataSource
      );
      const isMetricImportApply =
        isRichGridImport && activeStep === VALIDATION_STEP.EDIT_VALIDATE;

      const api = getImportValidateAPIEntityType(entityType);

      isBulkActionProcessingRef.current = {
        isProcessing: true,
        entityType,
      };

      const validateLoadData: CSVImportJobType = {
        type: 'onValidate',
      };

      setActiveAsyncImportJob(validateLoadData);
      activeAsyncImportJobRef.current = validateLoadData;
      setActiveImportLogLines([t('message.import-csv-connecting-service')]);

      if (isMetricImportApply) {
        handleActiveStepChange(VALIDATION_STEP.UPDATE);
      }

      await api({
        entityType,
        name: fqn,
        data: csvData,
        dryRun:
          activeStep === VALIDATION_STEP.EDIT_VALIDATE && !isMetricImportApply,
        recursive: !isBulkEdit,
        targetEntityType: effectiveSourceEntityType,
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
      setIsValidating(false);
      if (isRichGridImport && activeStep === VALIDATION_STEP.EDIT_VALIDATE) {
        handleActiveStepChange(VALIDATION_STEP.EDIT_VALIDATE);
      }
    }
  };

  const handleRetryCsvUpload = () => {
    setValidationData(undefined);
    setSelectedCsvFile(undefined);
    setActiveImportLogLines([]);
    handleResetImportJob();

    handleActiveStepChange(VALIDATION_STEP.UPLOAD);
  };

  const getVisibleCsvGridData = useCallback(
    (csv: string[][]) => {
      const parsedCsvData = getEntityColumnsAndDataSourceFromCSV(
        csv,
        importedEntityType,
        {
          user: entityRules.canAddMultipleUserOwners,
          team: entityRules.canAddMultipleTeamOwner,
        },
        false,
        isBulkEdit,
        shouldUseRichEditorGrid
      );

      return {
        ...parsedCsvData,
        columns: parsedCsvData.columns.filter((column) =>
          shouldShowCsvColumn(column.key ?? '')
        ),
      };
    },
    [
      entityRules,
      importedEntityType,
      isBulkEdit,
      shouldShowCsvColumn,
      shouldUseRichEditorGrid,
    ]
  );

  const handleImportWebsocketResponseWithActiveStep = useCallback(
    (importResults: CSVImportResult) => {
      const activeStep = activeStepRef.current;

      if (activeStep === VALIDATION_STEP.UPDATE) {
        if (importResults?.status === 'failure') {
          setValidationData(importResults);
          readString(importResults?.importResultsCsv ?? '', {
            worker: true,
            skipEmptyLines: true,
            complete: (results) => {
              // results.data is returning data with unknown type
              setValidateCSVData(
                getVisibleCsvGridData(results.data as string[][])
              );
            },
          });
          handleActiveStepChange(VALIDATION_STEP.UPDATE);
          setIsValidating(false);
        } else if (isRichGridImport) {
          setValidationData(importResults);
          readString(importResults?.importResultsCsv ?? '', {
            worker: true,
            skipEmptyLines: true,
            complete: (results) => {
              // results.data is returning data with unknown type
              setValidateCSVData(
                getVisibleCsvGridData(results.data as string[][])
              );
            },
          });
          handleResetImportJob();
          setIsValidating(false);
        } else {
          showSuccessToast(
            t('message.entity-details-updated', {
              entityType: capitalize(entityType),
              fqn,
            })
          );

          navigate(
            getBulkEntityNavigationPath(
              entityType,
              fqn,
              effectiveSourceEntityType
            )
          );

          handleResetImportJob();
          setIsValidating(false);
        }
      } else if (activeStep === VALIDATION_STEP.EDIT_VALIDATE) {
        setValidationData(importResults);
        handleActiveStepChange(VALIDATION_STEP.UPDATE);
        readString(importResults?.importResultsCsv ?? '', {
          worker: true,
          skipEmptyLines: true,
          complete: (results) => {
            // results.data is returning data with unknown type
            setValidateCSVData(
              getVisibleCsvGridData(results.data as string[][])
            );
          },
        });
        handleResetImportJob();
        setIsValidating(false);
      }
    },
    [
      activeStepRef,
      entityType,
      fqn,
      handleResetImportJob,
      handleActiveStepChange,
      isRichGridImport,
      effectiveSourceEntityType,
      getVisibleCsvGridData,
      navigate,
      readString,
      t,
    ]
  );

  const handleImportWebsocketResponse = useCallback(
    (websocketResponse: CSVImportAsyncWebsocketResponse) => {
      if (!websocketResponse.jobId) {
        return;
      }

      // If the job is started, then save the job data and message to the active job.
      // This will help in case of restAPI response, didn't come in time.
      if (
        websocketResponse.status === 'STARTED' &&
        isBulkActionProcessingRef.current.isProcessing &&
        isBulkActionProcessingRef.current.entityType === entityType
      ) {
        const processedStartedResponse = {
          ...websocketResponse,
          message: t('message.import-data-in-progress'),
        };

        setActiveAsyncImportJob((job) => {
          if (!job) {
            return;
          }

          return {
            ...job,
            ...processedStartedResponse,
          };
        });

        activeAsyncImportJobRef.current = {
          ...(activeAsyncImportJobRef.current as CSVImportJobType),
          ...processedStartedResponse,
        };
        appendActiveImportLogLine(processedStartedResponse.message);

        isBulkActionProcessingRef.current = {
          isProcessing: false,
          entityType: undefined,
        };

        return;
      }
      const activeImportJob = activeAsyncImportJobRef.current;
      if (websocketResponse.jobId === activeImportJob?.jobId) {
        appendActiveImportLogLine(websocketResponse.message);
        setActiveAsyncImportJob((job) => {
          if (!job) {
            return;
          }

          return {
            ...job,
            ...websocketResponse,
          };
        });

        if (websocketResponse.status === 'COMPLETED') {
          appendActiveImportLogLine(t('message.import-csv-job-completed'));
          const importResults = websocketResponse.result;
          setValidationData(importResults);
          fetchCsvJobs();

          // If the job is aborted, or failed before processing any rows (e.g. malformed CSV),
          // reset to upload step. If rows were processed but all failed, fall through to
          // show the validation grid so the user can inspect and fix errors.
          if (
            ['aborted'].includes(importResults?.status ?? '') ||
            (importResults?.status === 'failure' &&
              (importResults?.numberOfRowsProcessed ?? 0) === 0)
          ) {
            setValidationData(importResults);

            handleActiveStepChange(VALIDATION_STEP.UPLOAD);

            handleResetImportJob();

            return;
          }

          // If the job is complete and the status is success
          // and job was for initial load then check if the initial result is available
          // and then read the initial result
          if (
            activeImportJob.type === 'initialLoad' &&
            activeImportJob.initialResult
          ) {
            readString(activeImportJob.initialResult, {
              worker: true,
              skipEmptyLines: true,
              complete: (results) => {
                onCSVReadComplete(results as { data: string[][] });
                setIsValidating(false);
              },
            });

            handleResetImportJob();

            return;
          }

          handleImportWebsocketResponseWithActiveStep(
            importResults as CSVImportResult
          );
        }

        if (websocketResponse.status === 'FAILED') {
          appendActiveImportLogLine(
            websocketResponse.error ?? t('message.import-csv-job-failed')
          );
          fetchCsvJobs();
          setIsValidating(false);
        }
      }
    },
    [
      isBulkActionProcessingRef,
      activeAsyncImportJobRef,
      onCSVReadComplete,
      setActiveAsyncImportJob,
      handleResetImportJob,
      fetchCsvJobs,
      handleActiveStepChange,
      handleImportWebsocketResponseWithActiveStep,
      appendActiveImportLogLine,
      t,
    ]
  );

  useEffect(() => {
    fetchEntityData();
  }, [fetchEntityData]);

  useEffect(() => {
    if (!isListingBulkEdit || !csvDocumentation?.headers.length) {
      return;
    }

    const controller = new AbortController();

    hydrateBulkEditFromListing(controller.signal).catch((error) => {
      if (!controller.signal.aborted) {
        setBulkEditLoadState((state) => ({
          ...state,
          isLoading: false,
        }));
        showErrorToast(error as AxiosError);
      }
    });

    return () => controller.abort();
  }, [csvDocumentation, hydrateBulkEditFromListing, isListingBulkEdit]);

  useEffect(() => {
    const fetchDocumentation = async () => {
      try {
        const recursiveDocumentation =
          !isBulkEdit &&
          [
            EntityType.DATABASE_SERVICE,
            EntityType.DATABASE,
            EntityType.DATABASE_SCHEMA,
          ].includes(entityType);
        const documentation = await getCsvDocumentation(
          entityType,
          recursiveDocumentation
        );
        setCsvDocumentation(documentation);
      } catch {
        setCsvDocumentation(undefined);
      }
    };

    fetchDocumentation();
    fetchCsvJobs();
  }, [entityType, isBulkEdit, fetchCsvJobs]);

  useEffect(() => {
    if (socket) {
      socket.on(SOCKET_EVENTS.CSV_IMPORT_CHANNEL, (importResponse) => {
        if (importResponse) {
          const importResponseData = JSON.parse(
            importResponse
          ) as CSVImportAsyncWebsocketResponse;

          handleImportWebsocketResponse(importResponseData);
        }
      });
    }

    return () => {
      socket?.off(SOCKET_EVENTS.CSV_IMPORT_CHANNEL);
      handleResetImportJob();
    };
  }, [socket]);

  /*
    Owner dropdown uses <ProfilePicture /> which uses useUserProfile hook
    useUserProfile hook uses useApplicationStore hook
    Updating store will trigger re-render of the component
    This will cause the owner dropdown or full grid to re-render
  */
  const editableDataSource = useMemo(() => {
    if (rowFilter === 'failed') {
      return dataSource.filter((row) => row.status === 'failure');
    }

    return dataSource;
  }, [dataSource, rowFilter]);

  const editDataGrid = useMemo(() => {
    return (
      <div className="om-rdg" ref={setGridContainer}>
        <LazyDataGrid
          className="rdg-light"
          columns={
            filterColumns as unknown as ColumnOrColumnGroup<
              NoInfer<Record<string, string>>,
              unknown
            >[]
          }
          rows={editableDataSource}
          onCopy={handleCopy}
          onPaste={handlePaste}
          onRowsChange={handleOnRowsChange}
        />
      </div>
    );
  }, [
    columns,
    editableDataSource,
    handleCopy,
    handlePaste,
    handleOnRowsChange,
    setGridContainer,
  ]);

  const importResultColumns = useMemo(() => {
    if (!validateCSVData) {
      return [];
    }
    const operationColumn: Column<Record<string, string>> = {
      key: IMPORT_OPERATION_COLUMN_KEY,
      name: t('label.operation'),
      sortable: false,
      resizable: false,
      frozen: true,
      minWidth: COLUMNS_WIDTH.operation,
      width: COLUMNS_WIDTH.operation,
      cellClass: () => 'rdg-cell-operation',
      renderCell: ({ row }: RenderCellProps<Record<string, string>>) => (
        <OperationBadge operation={getImportOperation(row)} />
      ),
    };

    return [operationColumn, ...validateCSVData.columns];
  }, [validateCSVData, t]);

  const importOperationSummary = useMemo(
    () =>
      validateCSVData
        ? getImportOperationSummary(validateCSVData.dataSource)
        : undefined,
    [validateCSVData]
  );

  const activeJobProgress = useMemo(() => {
    const total = activeAsyncImportJob?.total ?? activePersistedJob?.total ?? 0;
    const progress =
      activeAsyncImportJob?.progress ?? activePersistedJob?.progress ?? 0;

    return total > 0 ? Math.round((progress / total) * 100) : 0;
  }, [activeAsyncImportJob, activePersistedJob]);

  const activeImportLogItems = useMemo(() => {
    if (activeImportLogLines.length) {
      return activeImportLogLines.map((message, index) => ({
        key: `${index}-${message}`,
        level: 'info',
        message,
      }));
    }

    return (
      activePersistedJob?.logs?.map((log) => ({
        key: log.logId,
        level: log.level.toLowerCase(),
        message: log.message,
      })) ?? []
    );
  }, [activeImportLogLines, activePersistedJob?.logs]);

  const isCsvPreviewProcessing =
    activeAsyncImportJob?.type === 'initialLoad' && isValidating;

  const previewProcessingProgress = useMemo(() => {
    if (activeJobProgress > 0) {
      return activeJobProgress;
    }

    if (!activeAsyncImportJob?.jobId) {
      return 45;
    }

    if (activeAsyncImportJob.status === 'IN_PROGRESS') {
      return 78;
    }

    return 62;
  }, [
    activeAsyncImportJob?.jobId,
    activeAsyncImportJob?.status,
    activeJobProgress,
  ]);

  const csvPreviewProcessingStages = useMemo<
    {
      key: string;
      label: string;
      state: CsvProcessingStage;
    }[]
  >(
    () => [
      {
        key: 'reading',
        label: t('message.import-csv-reading-file'),
        state: 'done',
      },
      {
        key: 'parsing',
        label: t('message.import-csv-parsing-rows'),
        state: activeAsyncImportJob?.jobId ? 'done' : 'active',
      },
      {
        key: 'validating',
        label: t('message.import-csv-validating-catalog'),
        state: activeAsyncImportJob?.jobId ? 'active' : 'pending',
      },
      {
        key: 'preview',
        label: t('message.import-csv-building-preview'),
        state:
          activeAsyncImportJob?.status === 'COMPLETED' ? 'active' : 'pending',
      },
    ],
    [activeAsyncImportJob?.jobId, activeAsyncImportJob?.status, t]
  );

  const getCsvRowCountLabel = (rowCount: number) =>
    `${rowCount} ${t(rowCount === 1 ? 'label.row' : 'label.row-plural')
      .toLowerCase()
      .trim()}`;

  const renderCsvProcessingStage = ({
    key,
    label,
    state,
  }: {
    key: string;
    label: string;
    state: CsvProcessingStage;
  }) => (
    <div
      className={`csv-processing-stage csv-processing-stage-${state}`}
      key={key}>
      <span className="csv-processing-stage-icon">
        {state === 'done' ? (
          <CheckCircle size={16} />
        ) : state === 'active' ? (
          <RefreshCw01 className="csv-import-spin" size={16} />
        ) : (
          <span className="csv-processing-stage-dot" />
        )}
      </span>
      <span>{label}</span>
    </div>
  );

  const renderSelectedCsvFile = () => {
    if (!selectedCsvFile) {
      return (
        <UploadFile
          acceptedFileDescription={t('message.accepts-file-up-to-size', {
            fileType: '.csv',
            size: '10 MB',
          })}
          disabled={Boolean(
            activeAsyncImportJob?.jobId && isEmpty(activeAsyncImportJob.error)
          )}
          fileType=".csv"
          variant={importUploadConfig?.variant ?? 'default'}
          onCSVUploaded={handleLoadData}
        />
      );
    }

    return (
      <div className="csv-selected-file-card">
        <div className="csv-selected-file-icon">
          <File06 size={22} />
        </div>
        <div className="csv-selected-file-body">
          <span className="csv-selected-file-name">{selectedCsvFile.name}</span>
          <span className="csv-selected-file-meta">
            {`${selectedCsvFile.sizeLabel} · ${getCsvRowCountLabel(
              selectedCsvFile.rowCount
            )}`}
          </span>
        </div>
        <button
          aria-label={t('label.remove')}
          className="csv-selected-file-remove"
          type="button"
          onClick={() => setSelectedCsvFile(undefined)}>
          <XClose size={18} />
        </button>
      </div>
    );
  };

  const renderProcessingCsvPreview = () => (
    <div className="csv-import-processing-wrap">
      <div className="csv-import-processing-card">
        <div className="csv-import-progress-icon">
          <RefreshCw01 className="csv-import-spin" />
        </div>
        <div className="csv-import-copy text-center">
          <h2>{t('message.import-csv-processing-title')}</h2>
          <p>
            <File06 size={14} />
            <span className="csv-import-processing-file-name">
              {selectedCsvFile?.name ?? t('label.csv')}
            </span>
            <span>{getCsvRowCountLabel(selectedCsvFile?.rowCount ?? 0)}</span>
          </p>
        </div>
        <ProgressBar value={previewProcessingProgress} />
        <div className="csv-processing-stage-list">
          {csvPreviewProcessingStages.map(renderCsvProcessingStage)}
        </div>
      </div>
    </div>
  );

  const renderUploadFooter = () => (
    <div className="csv-import-wizard-footer csv-import-wizard-footer-end import-footer">
      <div className="csv-import-wizard-footer-actions">
        <Button
          color="secondary"
          isDisabled={isCsvPreviewProcessing && !activeAsyncImportJob?.jobId}
          isLoading={isCsvPreviewProcessing && isCancellingJob}
          onPress={
            isCsvPreviewProcessing
              ? handleCancelActiveJob
              : handleRunInBackground
          }>
          {t('label.cancel')}
        </Button>
        <Button
          color="primary"
          iconTrailing={isCsvPreviewProcessing ? undefined : ChevronRight}
          isDisabled={!selectedCsvFile || isCsvPreviewProcessing}
          onPress={handleStartPreview}>
          {isCsvPreviewProcessing
            ? t('message.import-csv-parsing')
            : `${t('label.next')}: ${t('label.preview')}`}
        </Button>
      </div>
    </div>
  );

  const renderUploadStep = () => (
    <div className="csv-import-card csv-import-upload-card">
      <div className="csv-import-stack">
        <div className="csv-import-copy">
          <h2>
            {importUploadConfig
              ? t(importUploadConfig.headingKey)
              : t('label.import-entity', {
                  entity: entityDisplayName,
                })}
          </h2>
          <p>
            {importUploadConfig
              ? t(importUploadConfig.descriptionKey)
              : t('message.import-entity-help', {
                  entity: entityDisplayName,
                })}
          </p>
        </div>

        {!importUploadConfig?.hideRequiredHeaders &&
          !isEmpty(requiredCsvHeaders) && (
            <div className="csv-import-required">
              <span>{`${t('label.required')}:`}</span>
              {requiredCsvHeaders.map((header) => (
                <code key={header}>{header}</code>
              ))}
            </div>
          )}

        <div className="csv-import-action-row">
          <Button
            color="secondary"
            iconLeading={Download01}
            isDisabled={!csvDocumentation?.headers?.length}
            onPress={handleDownloadTemplate}>
            {`${t('label.download')} ${t('label.csv')} ${t('label.template')}`}
          </Button>
          <Button
            color="secondary"
            iconLeading={File06}
            onPress={() => setIsColumnReferenceOpen(true)}>
            {`${t('label.view')} ${t('label.column')} ${t(
              'label.reference-plural'
            )}`}
          </Button>
        </div>

        {renderSelectedCsvFile()}

        <Alert title={t('label.tip')} variant="brand">
          {t('message.import-entity-csv-tip', { entity: entityDisplayName })}
        </Alert>
      </div>
    </div>
  );

  const renderColumnReference = () => (
    <div className="csv-column-reference-table">
      {csvDocumentation?.headers?.length ? (
        <table>
          <thead>
            <tr>
              <th>{t('label.name')}</th>
              <th>{t('label.description')}</th>
              <th>{t('label.example-plural')}</th>
            </tr>
          </thead>
          <tbody>
            {csvDocumentation.headers.map((header) => (
              <tr key={header.name}>
                <td>
                  <div className="csv-column-name">
                    <code>{header.name}</code>
                    {header.required && (
                      <Badge color="blue" size="sm" type="color">
                        {t('label.required')}
                      </Badge>
                    )}
                  </div>
                </td>
                <td>{header.description}</td>
                <td>{header.examples?.join(', ') ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="csv-column-reference-empty">
          {t('message.no-data-available')}
        </p>
      )}
    </div>
  );

  const renderProgressMessage = () => (
    <div className="csv-import-progress-bar">
      <ProgressBar value={activeJobProgress} />
      <div className="csv-import-progress-labels">
        <span>
          {`${
            activeAsyncImportJob?.progress ?? activePersistedJob?.progress ?? 0
          } ${t('label.of-lowercase')} ${
            activeAsyncImportJob?.total ?? activePersistedJob?.total ?? 0
          }`}
        </span>
        <span>{`${activeJobProgress}%`}</span>
      </div>
    </div>
  );

  const renderImportProgress = () => (
    <div className="csv-import-card csv-import-progress-card">
      <div className="csv-import-progress-content">
        <div className="csv-import-progress-icon">
          <RefreshCw01 className="csv-import-spin" />
        </div>
        <div className="csv-import-copy text-center">
          <h2>
            {t('message.importing-entity', {
              entity: entityPluralDisplayName,
            })}
          </h2>
          <p>
            {activeAsyncImportJob?.message ??
              activePersistedJob?.message ??
              t('message.import-data-in-progress')}
          </p>
        </div>

        {renderProgressMessage()}

        <div className="csv-import-action-row justify-center">
          <Button isDisabled color="secondary">
            {t('label.pause')}
          </Button>
          <Button color="secondary" onPress={handleRunInBackground}>
            {t('label.run-in-background')}
          </Button>
        </div>

        {!isEmpty(activeImportLogItems) && (
          <div className="csv-import-log">
            {activeImportLogItems.map((log) => (
              <span
                className={`csv-import-log-line csv-import-log-line-${log.level}`}
                key={log.key}>
                {log.message}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="csv-import-progress-footer">
        <Button
          color="secondary-destructive"
          iconLeading={StopCircle}
          isDisabled={!activeAsyncImportJob?.jobId}
          isLoading={isCancellingJob}
          onPress={handleCancelActiveJob}>
          {t('label.cancel-entity', { entity: t('label.import') })}
        </Button>
      </div>
    </div>
  );

  const shouldRenderMetricImportEditor =
    isRichGridImport && activeStep === VALIDATION_STEP.EDIT_VALIDATE;

  const metricImportWorkflowHeaderConfig = useMemo(
    () => ({
      currentLabel: t('label.import'),
      description: t('message.import-entity-workflow-help'),
      steps: translatedSteps,
      title: t('label.import-entity', {
        entity: entityPluralDisplayName.toLowerCase(),
      }),
    }),
    [entityPluralDisplayName, t, translatedSteps]
  );

  return (
    <PageLayoutV1
      pageTitle={t('label.import-entity', {
        entity: entityType,
      })}>
      <div className="p-x-lg csv-import-page-stack">
        {isBulkEdit || shouldRenderMetricImportEditor ? (
          <BulkEditEntity
            activeAsyncImportJob={activeAsyncImportJob}
            activeStep={activeStep}
            breadcrumbList={breadcrumbList}
            changedCellCount={bulkEditChangeSummary.changedCellCount}
            changedCellKeysByRowId={
              bulkEditChangeSummary.changedCellKeysByRowId
            }
            changedRowCount={bulkEditChangeSummary.changedRowCount}
            columns={filterColumns}
            dataSource={dataSource}
            handleBack={handleBack}
            handleCopy={handleCopy}
            handleOnRowsChange={handleOnRowsChange}
            handlePaste={handlePaste}
            handleRevertChanges={handleRevertChanges}
            handleValidate={handleValidate}
            initialDataSource={initialDataSource}
            isExportHydrationRequired={isBulkEdit ? !isListingBulkEdit : false}
            isLoadingSourceData={bulkEditLoadState.isLoading}
            isNextDisabled={
              isBulkEdit
                ? bulkEditChangeSummary.changedCellCount === 0
                : dataSource.length === 0
            }
            isValidating={isValidating}
            pushToUndoStack={pushToUndoStack}
            setGridContainer={setGridContainer}
            sourceEntityType={effectiveSourceEntityType}
            validateCSVData={validateCSVData}
            validationData={validationData}
            workflowHeaderConfig={
              shouldRenderMetricImportEditor
                ? metricImportWorkflowHeaderConfig
                : undefined
            }
            workflowMode={
              shouldRenderMetricImportEditor ? 'import' : 'bulkEdit'
            }
            onCSVReadComplete={onCSVReadComplete}
          />
        ) : (
          <>
            <CsvWorkflowHeader
              activeStep={activeStep}
              breadcrumbList={breadcrumbList}
              currentLabel={t('label.import')}
              description={t('message.import-entity-workflow-help')}
              steps={translatedSteps}
              title={t('label.import-entity', {
                entity: entityPluralDisplayName.toLowerCase(),
              })}
            />
            <div>
              {activeAsyncImportJob?.jobId &&
                !isCsvPreviewProcessing &&
                activeStep !== VALIDATION_STEP.UPDATE && (
                  <div className="csv-import-banner-stack">
                    <Banner
                      className="border-radius"
                      isLoading={
                        isEmpty(activeAsyncImportJob.error) &&
                        activeAsyncImportJob.status !== 'IN_PROGRESS'
                      }
                      message={
                        activeAsyncImportJob.error ??
                        activeAsyncImportJob.message ??
                        ''
                      }
                      type={
                        activeAsyncImportJob.error
                          ? 'error'
                          : activeAsyncImportJob.status === 'IN_PROGRESS'
                          ? 'info'
                          : 'success'
                      }
                    />
                    {activeAsyncImportJob.status === 'IN_PROGRESS' &&
                      activeAsyncImportJob.total !== undefined &&
                      activeAsyncImportJob.total > 0 && (
                        <ProgressBar
                          value={
                            activeAsyncImportJob.total > 0
                              ? Math.round(
                                  ((activeAsyncImportJob.progress ?? 0) /
                                    activeAsyncImportJob.total) *
                                    100
                                )
                              : 0
                          }
                        />
                      )}
                  </div>
                )}
            </div>
            <div>
              {activeStep === 0 && (
                <>
                  {isCsvPreviewProcessing ? (
                    renderProcessingCsvPreview()
                  ) : validationData?.abortReason ? (
                    <div className="csv-import-card m-t-lg">
                      <div className="csv-import-abort-state">
                        <p className="text-center" data-testid="abort-reason">
                          <strong className="d-block">
                            {t('label.aborted')}
                          </strong>{' '}
                          {validationData.abortReason}
                        </p>
                        <Button
                          color="secondary"
                          data-testid="cancel-button"
                          onPress={handleRetryCsvUpload}>
                          {t('label.back')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    renderUploadStep()
                  )}
                </>
              )}
              {activeStep === 1 && (
                <div className="csv-import-card">
                  <div className="csv-import-stack">
                    <div className="csv-import-grid-toolbar">
                      <div>
                        {validationData && (
                          <ImportStatus csvImportResult={validationData} />
                        )}
                      </div>
                      <div className="csv-import-action-row">
                        <Button
                          color="secondary"
                          data-testid="add-row-btn"
                          iconLeading={Plus}
                          onPress={handleAddRow}>
                          {t('label.add-row')}
                        </Button>
                        <Button
                          color="secondary"
                          iconLeading={FilterLines}
                          onPress={() =>
                            setRowFilter((filter) =>
                              filter === 'all' ? 'failed' : 'all'
                            )
                          }>
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
                    {editDataGrid}
                  </div>
                </div>
              )}
              {activeStep === 2 && validationData && (
                <>
                  {isValidating && activeAsyncImportJob ? (
                    renderImportProgress()
                  ) : (
                    <div className="csv-import-card">
                      <div className="csv-import-stack">
                        <div className="csv-import-results-header">
                          {importOperationSummary && (
                            <OperationSummary
                              operations={IMPORT_OPERATIONS}
                              summary={importOperationSummary}
                            />
                          )}
                          <ImportStatus csvImportResult={validationData} />
                        </div>

                        <div>
                          {validateCSVData && (
                            <div className="om-rdg csv-import-results-rdg">
                              <LazyDataGrid
                                className="rdg-light"
                                columns={importResultColumns}
                                rowClass={getImportOperationRowClass}
                                rows={validateCSVData.dataSource}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {activeStep === 0 &&
              !validationData?.abortReason &&
              renderUploadFooter()}

            {isRichGridImport &&
              activeStep === VALIDATION_STEP.UPDATE &&
              !isValidating && (
                <div className="csv-import-wizard-footer import-footer">
                  <Button color="secondary" onPress={handleRetryCsvUpload}>
                    {t('label.import-more')}
                  </Button>
                  <Button color="primary" onPress={handleRunInBackground}>
                    {t('label.done')}
                  </Button>
                </div>
              )}

            {activeStep > 0 &&
              !(isValidating && activeAsyncImportJob) &&
              !(isRichGridImport && activeStep === VALIDATION_STEP.UPDATE) && (
                <div className="csv-import-wizard-footer import-footer">
                  {activeStep > 0 && (
                    <Button
                      color="secondary"
                      isDisabled={isValidating}
                      onPress={handleBack}>
                      {t('label.previous')}
                    </Button>
                  )}
                  <div className="csv-import-wizard-footer-actions">
                    <Button
                      color="secondary"
                      isDisabled={isValidating}
                      onPress={handleRunInBackground}>
                      {t('label.cancel')}
                    </Button>
                    <Button
                      color="primary"
                      isDisabled={isValidating}
                      onPress={handleValidate}>
                      {activeStep === VALIDATION_STEP.EDIT_VALIDATE &&
                      isRichGridImport
                        ? `${t('label.start')} ${t('label.import')}`
                        : activeStep === VALIDATION_STEP.UPDATE
                        ? t('label.update')
                        : t('label.next')}
                    </Button>
                  </div>
                </div>
              )}
            {isColumnReferenceOpen && (
              <ModalOverlay
                isOpen={isColumnReferenceOpen}
                onOpenChange={setIsColumnReferenceOpen}>
                <Modal>
                  <Dialog
                    showCloseButton
                    title={`${t('label.csv')} ${t('label.column')} ${t(
                      'label.reference-plural'
                    )}`}
                    width={900}
                    onClose={() => setIsColumnReferenceOpen(false)}>
                    <Dialog.Content className="csv-column-reference-modal">
                      {renderColumnReference()}
                    </Dialog.Content>
                  </Dialog>
                </Modal>
              </ModalOverlay>
            )}
          </>
        )}
      </div>
    </PageLayoutV1>
  );
};

export default BulkEntityImportPage;
