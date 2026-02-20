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
import { Button, Card, Col, Progress, Row, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import { capitalize, isEmpty, startCase } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DataGrid, { Column, ColumnOrColumnGroup } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import { useTranslation } from 'react-i18next';
import { usePapaParse } from 'react-papaparse';
import { useLocation, useNavigate } from 'react-router-dom';
import BulkEditEntity from '../../../components/BulkEditEntity/BulkEditEntity.component';
import Banner from '../../../components/common/Banner/Banner';
import { ImportStatus } from '../../../components/common/EntityImport/ImportStatus/ImportStatus.component';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import { DataAssetsHeaderProps } from '../../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { ProfilerTabPath } from '../../../components/Database/Profiler/ProfilerDashboard/profilerDashboard.interface';
import PageLayoutV1 from '../../../components/PageLayoutV1/PageLayoutV1';
import Stepper from '../../../components/Settings/Services/Ingestion/IngestionStepper/IngestionStepper.component';
import UploadFile from '../../../components/UploadFile/UploadFile';
import {
  ENTITY_IMPORT_STEPS,
  VALIDATION_STEP,
} from '../../../constants/BulkImport.constant';
import { WILD_CARD_CHAR } from '../../../constants/char.constants';
import { SOCKET_EVENTS } from '../../../constants/constants';
import { useWebSocketConnector } from '../../../context/WebSocketProvider/WebSocketProvider';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { CSVImportResult } from '../../../generated/type/csvImportResult';
import { useEntityRules } from '../../../hooks/useEntityRules';
import { useFqn } from '../../../hooks/useFqn';
import { useGridEditController } from '../../../hooks/useGridEditController';
import {
  getCSVStringFromColumnsAndDataSource,
  getEntityColumnsAndDataSourceFromCSV,
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
import {
  getDataQualityPagePath,
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

  const effectiveSourceEntityType = useMemo(() => {
    return sourceEntityType ?? sourceEntityTypeFromURL;
  }, [sourceEntityType, sourceEntityTypeFromURL]);

  const filterColumns = useMemo(
    () =>
      columns?.filter(
        (col) =>
          !csvUtilsClassBase.hideImportsColumnList().includes(col.key ?? '')
      ),
    [columns]
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

  const isBulkEdit = useMemo(
    () => isBulkEditRoute(location.pathname),
    [location]
  );

  const breadcrumbList: TitleBreadcrumbProps['titleLinks'] = useMemo(() => {
    if (fqn === WILD_CARD_CHAR) {
      return [
        {
          name: t('label.data-quality'),
          url: getDataQualityPagePath(DataQualityPageTabs.TEST_CASES),
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
          url: getDataQualityPagePath(DataQualityPageTabs.TEST_SUITES),
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

  const importedEntityType = useMemo(
    () => getImportedEntityType(entityType),
    [entityType]
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
      setDataSource(dataSource);
      setColumns(columns);

      handleActiveStepChange(VALIDATION_STEP.EDIT_VALIDATE);
    },
    [isBulkEdit, entityRules, setDataSource, setColumns, handleActiveStepChange]
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
      const csvData = getCSVStringFromColumnsAndDataSource(columns, dataSource);

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
                getEntityColumnsAndDataSourceFromCSV(
                  results.data as string[][],
                  importedEntityType,
                  {
                    user: entityRules.canAddMultipleUserOwners,
                    team: entityRules.canAddMultipleTeamOwner,
                  },
                  false,
                  isBulkEdit
                )
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
              getEntityColumnsAndDataSourceFromCSV(
                results.data as string[][],
                importedEntityType,
                {
                  user: entityRules.canAddMultipleUserOwners,
                  team: entityRules.canAddMultipleTeamOwner,
                },
                false,
                isBulkEdit
              )
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
      isBulkEdit,
      entityRules,
      importedEntityType,
      handleResetImportJob,
      handleActiveStepChange,
      effectiveSourceEntityType,
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

          // If the job is complete and the status is either failure or aborted
          // then reset the validation data and active step
          if (['failure', 'aborted'].includes(importResults?.status ?? '')) {
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
      handleActiveStepChange,
      handleImportWebsocketResponseWithActiveStep,
    ]
  );

  useEffect(() => {
    fetchEntityData();
  }, [fetchEntityData]);

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
  const editDataGrid = useMemo(() => {
    return (
      <div className="om-rdg" ref={setGridContainer}>
        <DataGrid
          className="rdg-light"
          columns={
            filterColumns as unknown as ColumnOrColumnGroup<
              NoInfer<Record<string, string>>,
              unknown
            >[]
          }
          rows={dataSource}
          onCopy={handleCopy}
          onPaste={handlePaste}
          onRowsChange={handleOnRowsChange}
        />
      </div>
    );
  }, [
    columns,
    dataSource,
    handleCopy,
    handlePaste,
    handleOnRowsChange,
    setGridContainer,
  ]);

  return (
    <PageLayoutV1
      pageTitle={t('label.import-entity', {
        entity: entityType,
      })}>
      <Row className="p-x-lg" gutter={[16, 16]}>
        {isBulkEdit ? (
          <BulkEditEntity
            activeAsyncImportJob={activeAsyncImportJob}
            activeStep={activeStep}
            breadcrumbList={breadcrumbList}
            columns={filterColumns}
            dataSource={dataSource}
            handleBack={handleBack}
            handleCopy={handleCopy}
            handleOnRowsChange={handleOnRowsChange}
            handlePaste={handlePaste}
            handleValidate={handleValidate}
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
            <Col span={24}>
              <TitleBreadcrumb titleLinks={breadcrumbList} />
            </Col>
            <Col span={24}>
              <Stepper activeStep={activeStep} steps={translatedSteps} />
            </Col>
            <Col span={24}>
              {activeAsyncImportJob?.jobId && (
                <Space className="w-full" direction="vertical" size="small">
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
                      <Progress
                        showInfo
                        percent={Math.round(
                          ((activeAsyncImportJob.progress ?? 0) /
                            activeAsyncImportJob.total) *
                            100
                        )}
                        status="active"
                      />
                    )}
                </Space>
              )}
            </Col>
            <Col span={24}>
              {activeStep === 0 && (
                <>
                  {validationData?.abortReason ? (
                    <Card className="m-t-lg">
                      <Space
                        align="center"
                        className="w-full justify-center p-lg text-center"
                        direction="vertical"
                        size={16}>
                        <Typography.Text
                          className="text-center"
                          data-testid="abort-reason">
                          <strong className="d-block">
                            {t('label.aborted')}
                          </strong>{' '}
                          {validationData.abortReason}
                        </Typography.Text>
                        <Space size={16}>
                          <Button
                            ghost
                            data-testid="cancel-button"
                            type="primary"
                            onClick={handleRetryCsvUpload}>
                            {t('label.back')}
                          </Button>
                        </Space>
                      </Space>
                    </Card>
                  ) : (
                    <UploadFile
                      disabled={Boolean(
                        activeAsyncImportJob?.jobId &&
                          isEmpty(activeAsyncImportJob.error)
                      )}
                      fileType=".csv"
                      onCSVUploaded={handleLoadData}
                    />
                  )}
                </>
              )}
              {activeStep === 1 && editDataGrid}
              {activeStep === 2 && validationData && (
                <Row gutter={[16, 16]}>
                  <Col span={24}>
                    <ImportStatus csvImportResult={validationData} />
                  </Col>

                  <Col span={24}>
                    {validateCSVData && (
                      <div className="om-rdg">
                        <DataGrid
                          className="rdg-light"
                          columns={validateCSVData.columns}
                          rows={validateCSVData.dataSource}
                        />
                      </div>
                    )}
                  </Col>
                </Row>
              )}
            </Col>

            {activeStep > 0 && (
              <Col span={24}>
                {activeStep === 1 && (
                  <Button data-testid="add-row-btn" onClick={handleAddRow}>
                    {`+ ${t('label.add-row')}`}
                  </Button>
                )}
                <div className="float-right import-footer">
                  {activeStep > 0 && (
                    <Button disabled={isValidating} onClick={handleBack}>
                      {t('label.previous')}
                    </Button>
                  )}
                  {activeStep < 3 && (
                    <Button
                      className="m-l-sm"
                      disabled={isValidating}
                      type="primary"
                      onClick={handleValidate}>
                      {activeStep === 2 ? t('label.update') : t('label.next')}
                    </Button>
                  )}
                </div>
              </Col>
            )}
          </>
        )}
      </Row>
    </PageLayoutV1>
  );
};

export default BulkEntityImportPage;
