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
  Download01,
  File06,
  FilterLines,
  Plus,
  RefreshCcw01,
  RefreshCw01,
  StopCircle,
} from '@untitledui/icons';
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
import { CsvJobsTray } from '../../../components/common/EntityImport/CsvJobsTray/CsvJobsTray.component';
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
  COLUMNS_WIDTH,
  getCSVStringFromColumnsAndDataSource,
  getEntityColumnsAndDataSourceFromCSV,
  getImportOperation,
  getImportOperationRowClass,
  getImportOperationSummary,
  IMPORT_OPERATIONS,
  IMPORT_OPERATION_COLUMN_KEY,
  isMetricBulkEditHiddenColumn,
} from '../../../utils/CSV/CSV.utils';
import csvUtilsClassBase from '../../../utils/CSV/CSVUtilsClassBase';
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
  CSVImportAsyncWebsocketResponse,
  CSVImportJobType,
} from './BulkEntityImportPage.interface';

interface BulkEntityImportLocationState {
  selectedMetricNames?: string[];
}

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

  const selectedMetricNamesForBulkEdit = useMemo(() => {
    const routeState = location.state as BulkEntityImportLocationState | null;

    return routeState?.selectedMetricNames ?? [];
  }, [location.state]);

  const [activeStep, setActiveStep] = useState<VALIDATION_STEP>(
    VALIDATION_STEP.UPLOAD
  );
  const activeStepRef = useRef<VALIDATION_STEP>(VALIDATION_STEP.UPLOAD);
  const { t } = useTranslation();
  const { entityType } = useRequiredParams<{ entityType: EntityType }>();
  const { fqn } = useFqn();
  const [isValidating, setIsValidating] = useState(false);
  const { entityRules } = useEntityRules(entityType);

  const translatedSteps = useMemo(
    () =>
      ENTITY_IMPORT_STEPS.map((step) => ({
        ...step,
        name: startCase(t(step.name)),
      })),
    [t]
  );
  const [validationData, setValidationData] = useState<CSVImportResult>();
  const [columns, setColumns] = useState<Column<Record<string, string>[]>[]>(
    []
  );
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

  const effectiveSourceEntityType = useMemo(() => {
    return sourceEntityType ?? sourceEntityTypeFromURL;
  }, [sourceEntityType, sourceEntityTypeFromURL]);

  const isBulkEdit = useMemo(
    () => isBulkEditRoute(location.pathname),
    [location]
  );

  const importedEntityType = useMemo(
    () => getImportedEntityType(entityType),
    [entityType]
  );

  const shouldShowCsvColumn = useCallback(
    (columnKey: string) =>
      !csvUtilsClassBase.hideImportsColumnList().includes(columnKey) &&
      !isMetricBulkEditHiddenColumn(columnKey, importedEntityType, isBulkEdit),
    [importedEntityType, isBulkEdit]
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

  const handleDownloadTemplate = useCallback(() => {
    if (!csvDocumentation?.headers?.length) {
      return;
    }

    const fields = csvDocumentation.headers.map((header) => header.name);
    const exampleRow = csvDocumentation.headers.reduce<Record<string, string>>(
      (acc, header) => {
        acc[header.name] = header.examples?.[0] ?? '';

        return acc;
      },
      {}
    );

    downloadFile(unparse({ fields, data: [exampleRow] }), `${entityType}.csv`);
  }, [csvDocumentation, entityType]);

  const handleRevertChanges = useCallback(() => {
    setDataSource(initialDataSource);
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
        isBulkEdit
      );

      const filteredDataSource =
        isBulkEdit &&
        entityType === EntityType.METRIC &&
        selectedMetricNamesForBulkEdit.length
          ? dataSource.filter((row) =>
              selectedMetricNamesForBulkEdit.includes(row.name)
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
    ]
  );

  const handleLoadData = useCallback(
    async (e: ProgressEvent<FileReader>) => {
      try {
        isBulkActionProcessingRef.current = {
          isProcessing: true,
          entityType,
        };
        const result = e.target?.result as string;

        const initialLoadJobData: CSVImportJobType = {
          type: 'initialLoad',
          initialResult: result,
        };

        setActiveAsyncImportJob(initialLoadJobData);
        activeAsyncImportJobRef.current = initialLoadJobData;

        await validateCsvString(
          result,
          entityType,
          fqn,
          isBulkEdit,
          effectiveSourceEntityType
        );
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [entityType, fqn, isBulkEdit, effectiveSourceEntityType]
  );

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

      await api({
        entityType,
        name: fqn,
        data: csvData,
        dryRun: activeStep === VALIDATION_STEP.EDIT_VALIDATE,
        recursive: !isBulkEdit,
        targetEntityType: effectiveSourceEntityType,
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
      setIsValidating(false);
    }
  };

  const handleRetryCsvUpload = () => {
    setValidationData(undefined);

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
        isBulkEdit
      );

      return {
        ...parsedCsvData,
        columns: parsedCsvData.columns.filter((column) =>
          shouldShowCsvColumn(column.key ?? '')
        ),
      };
    },
    [entityRules, importedEntityType, isBulkEdit, shouldShowCsvColumn]
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

        isBulkActionProcessingRef.current = {
          isProcessing: false,
          entityType: undefined,
        };

        return;
      }
      const activeImportJob = activeAsyncImportJobRef.current;
      if (websocketResponse.jobId === activeImportJob?.jobId) {
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
              complete: onCSVReadComplete,
            });

            handleResetImportJob();

            return;
          }

          handleImportWebsocketResponseWithActiveStep(
            importResults as CSVImportResult
          );
        }

        if (websocketResponse.status === 'FAILED') {
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
    ]
  );

  useEffect(() => {
    fetchEntityData();
  }, [fetchEntityData]);

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

  const renderUploadStep = () => (
    <div className="csv-import-card csv-import-upload-card">
      <div className="csv-import-stack">
        <div className="csv-import-copy">
          <h2>
            {entityType === EntityType.METRIC
              ? t('message.import-metrics-upload-heading')
              : t('label.import-entity', {
                  entity: entityDisplayName,
                })}
          </h2>
          <p>
            {entityType === EntityType.METRIC
              ? t('message.import-metrics-upload-description')
              : t('message.import-entity-help', {
                  entity: entityDisplayName,
                })}
          </p>
        </div>

        {!isEmpty(requiredCsvHeaders) && (
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

        <UploadFile
          disabled={Boolean(
            activeAsyncImportJob?.jobId && isEmpty(activeAsyncImportJob.error)
          )}
          fileType=".csv"
          onCSVUploaded={handleLoadData}
        />

        <Alert title={t('label.tip')} variant="brand">
          {t('message.import-metrics-csv-tip')}
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
          } / ${activeAsyncImportJob?.total ?? activePersistedJob?.total ?? 0}`}
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
          <Button color="secondary" onPress={handleRunInBackground}>
            {t('label.run-in-background')}
          </Button>
          <Button
            color="secondary-destructive"
            iconLeading={StopCircle}
            isLoading={isCancellingJob}
            onPress={handleCancelActiveJob}>
            {t('label.cancel-entity', { entity: t('label.import') })}
          </Button>
        </div>

        {!isEmpty(activePersistedJob?.logs) && (
          <div className="csv-import-log">
            {activePersistedJob?.logs?.map((log) => (
              <span
                className={`csv-import-log-line csv-import-log-line-${log.level.toLowerCase()}`}
                key={log.logId}>
                {log.message}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <PageLayoutV1
      pageTitle={t('label.import-entity', {
        entity: entityType,
      })}>
      <div className="p-x-lg csv-import-page-stack">
        {isBulkEdit ? (
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
            handleValidate={handleValidate}
            initialDataSource={initialDataSource}
            isValidating={isValidating}
            pushToUndoStack={pushToUndoStack}
            setGridContainer={setGridContainer}
            sourceEntityType={effectiveSourceEntityType}
            validateCSVData={validateCSVData}
            validationData={validationData}
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
              {activeAsyncImportJob?.jobId && (
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
                  {validationData?.abortReason ? (
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
                  {isValidating && activeAsyncImportJob?.jobId ? (
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

            {activeStep > 0 && (
              <div>
                <div className="float-right import-footer">
                  {activeStep > 0 && (
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
                      isDisabled={isValidating}
                      onPress={handleValidate}>
                      {activeStep === 2 ? t('label.update') : t('label.next')}
                    </Button>
                  )}
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
      <CsvJobsTray />
    </PageLayoutV1>
  );
};

export default BulkEntityImportPage;
