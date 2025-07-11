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
import ReactDataGrid from '@inovua/reactdatagrid-community';
import '@inovua/reactdatagrid-community/index.css';
import {
  TypeColumn,
  TypeComputedProps,
  TypeEditInfo,
} from '@inovua/reactdatagrid-community/types';
import { Button, Card, Col, Row, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import { capitalize, isEmpty } from 'lodash';
import {
  MutableRefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { usePapaParse } from 'react-papaparse';
import { useLocation, useNavigate } from 'react-router-dom';
import BulkEditEntity from '../../../components/BulkEditEntity/BulkEditEntity.component';
import Banner from '../../../components/common/Banner/Banner';
import { ImportStatus } from '../../../components/common/EntityImport/ImportStatus/ImportStatus.component';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import { DataAssetsHeaderProps } from '../../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import PageLayoutV1 from '../../../components/PageLayoutV1/PageLayoutV1';
import Stepper from '../../../components/Settings/Services/Ingestion/IngestionStepper/IngestionStepper.component';
import { UploadFile } from '../../../components/UploadFile/UploadFile';
import {
  ENTITY_IMPORT_STEPS,
  VALIDATION_STEP,
} from '../../../constants/BulkImport.constant';
import { SOCKET_EVENTS } from '../../../constants/constants';
import { useWebSocketConnector } from '../../../context/WebSocketProvider/WebSocketProvider';
import { EntityType } from '../../../enums/entity.enum';
import { CSVImportResult } from '../../../generated/type/csvImportResult';
import { useFqn } from '../../../hooks/useFqn';
import {
  getCSVStringFromColumnsAndDataSource,
  getEntityColumnsAndDataSourceFromCSV,
} from '../../../utils/CSV/CSV.utils';
import csvUtilsClassBase from '../../../utils/CSV/CSVUtilsClassBase';
import { isBulkEditRoute } from '../../../utils/EntityBulkEdit/EntityBulkEditUtils';
import {
  getBulkEntityBreadcrumbList,
  getImportedEntityType,
  getImportValidateAPIEntityType,
  validateCsvString,
} from '../../../utils/EntityImport/EntityImportUtils';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import './bulk-entity-import-page.less';
import {
  CSVImportAsyncWebsocketResponse,
  CSVImportJobType,
} from './BulkEntityImportPage.interface';

let inEdit = false;

const BulkEntityImportPage = () => {
  const { socket } = useWebSocketConnector();
  const [activeAsyncImportJob, setActiveAsyncImportJob] =
    useState<CSVImportJobType>();
  const activeAsyncImportJobRef = useRef<CSVImportJobType>();

  const [activeStep, setActiveStep] = useState<VALIDATION_STEP>(
    VALIDATION_STEP.UPLOAD
  );
  const activeStepRef = useRef<VALIDATION_STEP>(VALIDATION_STEP.UPLOAD);

  const location = useLocation();
  const { t } = useTranslation();
  const { entityType } = useRequiredParams<{ entityType: EntityType }>();
  const { fqn } = useFqn();
  const [isValidating, setIsValidating] = useState(false);
  const [validationData, setValidationData] = useState<CSVImportResult>();
  const [columns, setColumns] = useState<TypeColumn[]>([]);
  const [dataSource, setDataSource] = useState<Record<string, string>[]>([]);
  const navigate = useNavigate();
  const { readString } = usePapaParse();
  const [validateCSVData, setValidateCSVData] =
    useState<{ columns: TypeColumn[]; dataSource: Record<string, string>[] }>();
  const [gridRef, setGridRef] = useState<
    MutableRefObject<TypeComputedProps | null>
  >({ current: null });
  const [entity, setEntity] = useState<DataAssetsHeaderProps['dataAsset']>();
  const [loading, setLoading] = useState(false);

  const filterColumns = useMemo(
    () =>
      columns?.filter(
        (col) =>
          !csvUtilsClassBase.hideImportsColumnList().includes(col.name ?? '')
      ),
    [columns]
  );

  const fetchEntityData = useCallback(async () => {
    try {
      const response = await entityUtilClassBase.getEntityByFqn(
        entityType,
        fqn
      );
      setEntity(response);
    } catch {
      // not show error here
    }
  }, [entityType, fqn]);

  const isBulkEdit = useMemo(
    () => isBulkEditRoute(location.pathname),
    [location]
  );

  const breadcrumbList: TitleBreadcrumbProps['titleLinks'] = useMemo(
    () =>
      entity ? getBulkEntityBreadcrumbList(entityType, entity, isBulkEdit) : [],
    [entityType, entity, isBulkEdit]
  );

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

  const focusToGrid = useCallback(() => {
    setGridRef((ref) => {
      ref.current?.focus();

      return ref;
    });
  }, [setGridRef]);

  const onCSVReadComplete = useCallback(
    (results: { data: string[][] }) => {
      // results.data is returning data with unknown type
      const { columns, dataSource } = getEntityColumnsAndDataSourceFromCSV(
        results.data as string[][],
        importedEntityType
      );
      setDataSource(dataSource);
      setColumns(columns);

      handleActiveStepChange(VALIDATION_STEP.EDIT_VALIDATE);
      setTimeout(focusToGrid, 500);
    },
    [setDataSource, setColumns, handleActiveStepChange, focusToGrid]
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
                getEntityColumnsAndDataSourceFromCSV(
                  results.data as string[][],
                  importedEntityType
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
          navigate(entityUtilClassBase.getEntityLink(entityType, fqn));
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
                importedEntityType
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
      importedEntityType,
      handleResetImportJob,
      handleActiveStepChange,
      history,
    ]
  );

  const handleImportWebsocketResponse = useCallback(
    (websocketResponse: CSVImportAsyncWebsocketResponse) => {
      if (!websocketResponse.jobId) {
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

          handleImportWebsocketResponseWithActiveStep(importResults);
        }

        if (websocketResponse.status === 'FAILED') {
          setIsValidating(false);
        }
      }
    },
    [
      activeStepRef,
      activeAsyncImportJobRef,
      onCSVReadComplete,
      setActiveAsyncImportJob,
      handleResetImportJob,
      handleActiveStepChange,
      handleImportWebsocketResponseWithActiveStep,
    ]
  );

  const handleLoadData = useCallback(
    async (e: ProgressEvent<FileReader>) => {
      setLoading(true);
      try {
        const result = e.target?.result as string;
        const validationResponse = await validateCsvString(
          result,
          entityType,
          fqn,
          isBulkEdit
        );

        const jobData: CSVImportJobType = {
          ...validationResponse,
          type: 'initialLoad',
          initialResult: result,
        };

        setActiveAsyncImportJob(jobData);
        activeAsyncImportJobRef.current = jobData;
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setLoading(false);
      }
    },
    [onCSVReadComplete, entityType, fqn]
  );

  const onEditComplete = useCallback(
    ({ value, columnId, rowId }: TypeEditInfo) => {
      const data = [...dataSource];
      data[parseInt(rowId)][columnId] = value;
      setDataSource(data);
    },
    [dataSource]
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

      const response = await api({
        entityType,
        name: fqn,
        data: csvData,
        dryRun: activeStep === VALIDATION_STEP.EDIT_VALIDATE,
        recursive: !isBulkEdit,
      });

      const jobData: CSVImportJobType = {
        ...response,
        type: 'onValidate',
      };

      setActiveAsyncImportJob(jobData);
      activeAsyncImportJobRef.current = jobData;
    } catch (error) {
      showErrorToast(error as AxiosError);
      setIsValidating(false);
    }
  };

  const onEditStart = () => {
    inEdit = true;
  };

  const onEditStop = () => {
    requestAnimationFrame(() => {
      inEdit = false;
      gridRef.current?.focus();
    });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (inEdit) {
      if (event.key === 'Escape') {
        const [rowIndex, colIndex] = gridRef.current?.computedActiveCell ?? [
          0, 0,
        ];
        const column = gridRef.current?.getColumnBy(colIndex);

        gridRef.current?.cancelEdit?.({
          rowIndex,
          columnId: column?.name ?? '',
        });
      }

      return;
    }
    const grid = gridRef.current;
    if (!grid) {
      return;
    }
    let [rowIndex, colIndex] = grid.computedActiveCell ?? [0, 0];

    if (event.key === ' ' || event.key === 'Enter') {
      const column = grid.getColumnBy(colIndex);
      grid.startEdit?.({ columnId: column.name ?? '', rowIndex });
      event.preventDefault();

      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    const direction = event.shiftKey ? -1 : 1;

    const columns = grid.visibleColumns;
    const rowCount = grid.count;

    colIndex += direction;
    if (colIndex === -1) {
      colIndex = columns.length - 1;
      rowIndex -= 1;
    }
    if (colIndex === columns.length) {
      rowIndex += 1;
      colIndex = 0;
    }
    if (rowIndex < 0 || rowIndex === rowCount) {
      return;
    }

    grid?.setActiveCell([rowIndex, colIndex]);
  };

  const handleAddRow = useCallback(() => {
    setDataSource((data) => {
      setTimeout(() => {
        gridRef.current?.scrollToId(data.length + '');
        gridRef.current?.focus();
      }, 1);

      return [...data, { id: data.length + '' }];
    });
  }, [gridRef]);

  const handleRetryCsvUpload = () => {
    setValidationData(undefined);

    handleActiveStepChange(VALIDATION_STEP.UPLOAD);
  };

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
      socket && socket.off(SOCKET_EVENTS.CSV_IMPORT_CHANNEL);
    };
  }, [socket]);

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
            handleValidate={handleValidate}
            isValidating={isValidating}
            setGridRef={setGridRef}
            validateCSVData={validateCSVData}
            validationData={validationData}
            onCSVReadComplete={onCSVReadComplete}
            onEditComplete={onEditComplete}
            onEditStart={onEditStart}
            onEditStop={onEditStop}
            onKeyDown={onKeyDown}
          />
        ) : (
          <>
            <Col span={24}>
              <TitleBreadcrumb titleLinks={breadcrumbList} />
            </Col>
            <Col span={24}>
              <Stepper activeStep={activeStep} steps={ENTITY_IMPORT_STEPS} />
            </Col>
            <Col span={24}>
              {(loading || activeAsyncImportJob?.jobId) && (
                <Banner
                  className="border-radius"
                  isLoading={isEmpty(activeAsyncImportJob?.error)}
                  message={
                    activeAsyncImportJob?.error ??
                    activeAsyncImportJob?.message ??
                    t('message.import-data-in-progress') ??
                    ''
                  }
                  type={
                    !isEmpty(activeAsyncImportJob?.error) ? 'error' : 'success'
                  }
                />
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
                      fileType=".csv"
                      onCSVUploaded={handleLoadData}
                    />
                  )}
                </>
              )}
              {activeStep === 1 && (
                <ReactDataGrid
                  editable
                  columns={filterColumns}
                  dataSource={dataSource}
                  defaultActiveCell={[0, 0]}
                  handle={setGridRef}
                  idProperty="id"
                  loading={isValidating}
                  minRowHeight={30}
                  showZebraRows={false}
                  style={{ height: 'calc(100vh - 245px)' }}
                  onEditComplete={onEditComplete}
                  onEditStart={onEditStart}
                  onEditStop={onEditStop}
                  onKeyDown={onKeyDown}
                />
              )}
              {activeStep === 2 && validationData && (
                <Row gutter={[16, 16]}>
                  <Col span={24}>
                    <ImportStatus csvImportResult={validationData} />
                  </Col>

                  <Col span={24}>
                    {validateCSVData && (
                      <ReactDataGrid
                        idProperty="id"
                        loading={isValidating}
                        style={{ height: 'calc(100vh - 300px)' }}
                        {...validateCSVData}
                      />
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
