/*
 *  Copyright 2023 Collate.
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
import { Affix, Button, Card, Col, Row, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isUndefined } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as SuccessBadgeIcon } from '../../../assets/svg/success-badge.svg';
import { SOCKET_EVENTS } from '../../../constants/constants';
import { STEPS_FOR_IMPORT_ENTITY } from '../../../constants/entity.constants';
import { useWebSocketConnector } from '../../../context/WebSocketProvider/WebSocketProvider';
import {
  CSVImportResult,
  Status,
} from '../../../generated/type/csvImportResult';
import {
  CSVImportAsyncWebsocketResponse,
  CSVImportJobType,
} from '../../../pages/EntityImport/BulkEntityImportPage/BulkEntityImportPage.interface';
import { showErrorToast } from '../../../utils/ToastUtils';
import Stepper from '../../Settings/Services/Ingestion/IngestionStepper/IngestionStepper.component';
import { UploadFile } from '../../UploadFile/UploadFile';
import Banner from '../Banner/Banner';
import './entity-import.style.less';
import { EntityImportProps } from './EntityImport.interface';
import { ImportStatus } from './ImportStatus/ImportStatus.component';

export const EntityImport = ({
  entityName,
  onImport,
  onSuccess,
  onCancel,
  children,
  onCsvResultUpdate,
}: EntityImportProps) => {
  const { t } = useTranslation();

  const { socket } = useWebSocketConnector();
  const [activeAsyncImportJob, setActiveAsyncImportJob] =
    useState<CSVImportJobType>();
  const activeAsyncImportJobRef = useRef<CSVImportJobType>();

  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>('');
  const [csvFileResult, setCsvFileResult] = useState<string>('');
  const [csvImportResult, setCsvImportResult] = useState<CSVImportResult>();
  const [activeStep, setActiveStep] = useState<number>(1);
  const { isFailure, isAborted } = useMemo(() => {
    const status = csvImportResult?.status;

    const isFailure = status === Status.Failure;
    const isAborted = status === Status.Aborted;

    return {
      isFailure,
      isAborted,
    };
  }, [csvImportResult]);

  const handleLoadData = async (e: ProgressEvent<FileReader>) => {
    try {
      const result = e.target?.result as string;
      if (result) {
        const response = await onImport(entityName, result);

        const jobData: CSVImportJobType = {
          ...response,
          type: 'initialLoad',
          initialResult: result,
        };

        setActiveAsyncImportJob(jobData);
        activeAsyncImportJobRef.current = jobData;
      }
    } catch (error) {
      setCsvImportResult(undefined);
    }
  };

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const response = await onImport(entityName, csvFileResult, false);
      const jobData: CSVImportJobType = {
        ...response,
        type: 'onValidate',
      };
      setActiveAsyncImportJob(jobData);
      activeAsyncImportJobRef.current = jobData;
    } catch (error) {
      showErrorToast(error as AxiosError);
      setIsImporting(false);
    }
  };

  const handleCancel = () => {
    setCsvImportResult(undefined);
    setActiveStep(1);
  };

  const handleResetImportJob = useCallback(() => {
    setActiveAsyncImportJob(undefined);
    activeAsyncImportJobRef.current = undefined;
  }, [setActiveAsyncImportJob, activeAsyncImportJobRef]);

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

          // If the job is complete and the status is success
          // and job was for initial load then check if the initial result is available
          // and then read the initial result
          if (
            activeImportJob.type === 'initialLoad' &&
            activeImportJob.initialResult
          ) {
            setCsvImportResult(importResults);
            onCsvResultUpdate && onCsvResultUpdate(importResults);
            setCsvFileResult(activeImportJob.initialResult);
            setActiveStep(2);
            handleResetImportJob();

            return;
          }

          if (activeImportJob.type === 'onValidate') {
            setCsvImportResult(importResults);
            onCsvResultUpdate && onCsvResultUpdate(importResults);
            setActiveStep(3);
            setIsImporting(false);
            handleResetImportJob();

            return;
          }
        }
      }
    },
    [
      activeAsyncImportJobRef,
      setActiveAsyncImportJob,
      onCsvResultUpdate,
      handleResetImportJob,
    ]
  );

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

  const importStartedBanner = useMemo(() => {
    return activeAsyncImportJob?.jobId ? (
      <Banner
        className="border-radius"
        isLoading={!activeAsyncImportJob.error}
        message={
          activeAsyncImportJob.error ?? activeAsyncImportJob.message ?? ''
        }
        type={activeAsyncImportJob.error ? 'error' : 'success'}
      />
    ) : null;
  }, [activeAsyncImportJob]);

  return (
    <Row className="entity-import-container" gutter={[16, 16]}>
      <Col span={24}>
        <Stepper activeStep={activeStep} steps={STEPS_FOR_IMPORT_ENTITY} />
      </Col>
      <>
        {activeStep === 1 && (
          <>
            <Col span={24}>{importStartedBanner}</Col>
            <Col data-testid="upload-file-container" span={24}>
              <UploadFile
                beforeUpload={(file) => {
                  setFileName(file.name);
                }}
                fileType=".csv"
                onCSVUploaded={handleLoadData}
              />

              <Affix className="bg-white p-md import-preview-footer">
                <Space className="justify-end w-full p-r-md">
                  <Button
                    ghost
                    data-testid="cancel-button"
                    type="primary"
                    // as we need to redirect back, from where we enter import screen
                    onClick={onCancel}>
                    {t('label.cancel')}
                  </Button>
                </Space>
              </Affix>
            </Col>
          </>
        )}
        {activeStep === 2 && !isUndefined(csvImportResult) && (
          <Col span={24}>
            {isAborted ? (
              <Card className="m-t-lg">
                <Space
                  align="center"
                  className="w-full justify-center p-lg text-center"
                  direction="vertical"
                  size={16}>
                  <Typography.Text
                    className="text-center"
                    data-testid="abort-reason">
                    <strong className="d-block">{t('label.aborted')}</strong>{' '}
                    {csvImportResult.abortReason}
                  </Typography.Text>
                  <Space size={16}>
                    <Button
                      ghost
                      data-testid="cancel-button"
                      type="primary"
                      onClick={handleCancel}>
                      {t('label.back')}
                    </Button>
                  </Space>
                </Space>
              </Card>
            ) : (
              // added extra margin to prevent data lost due to fixed footer at bottom
              <div className="mb-16 m-t-lg">
                <Row data-testid="import-results" gutter={[16, 16]}>
                  <Col span={24}>{importStartedBanner}</Col>
                  <Col span={24}>
                    <ImportStatus csvImportResult={csvImportResult} />
                  </Col>
                  <Col span={24}>{children}</Col>
                </Row>
                <Affix className="bg-white p-md import-preview-footer">
                  <Space className="justify-end w-full p-r-md">
                    <Button
                      ghost
                      data-testid="preview-cancel-button"
                      disabled={isImporting}
                      type="primary"
                      onClick={handleCancel}>
                      {t('label.back')}
                    </Button>
                    {!isFailure && (
                      <Button
                        data-testid="import-button"
                        disabled={isImporting}
                        type="primary"
                        onClick={handleImport}>
                        {t('label.import')}
                      </Button>
                    )}
                  </Space>
                </Affix>
              </div>
            )}
          </Col>
        )}

        {activeStep > 2 && (
          <Col span={24}>
            <Card className="m-t-lg">
              <Space
                align="center"
                className="w-full justify-center p-lg"
                direction="vertical"
                size={16}>
                <SuccessBadgeIcon data-testid="success-badge" width={36} />

                <Typography.Text>
                  <strong data-testid="file-name">{fileName}</strong>{' '}
                  {`${t('label.successfully-uploaded')}.`}
                </Typography.Text>
                <Space size={16}>
                  <Button
                    data-testid="preview-button"
                    type="primary"
                    onClick={onSuccess}>
                    {t('label.view')}
                  </Button>
                </Space>
              </Space>
            </Card>
          </Col>
        )}
      </>
    </Row>
  );
};
