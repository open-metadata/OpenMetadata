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
import {
  Affix,
  Button,
  Card,
  Col,
  Row,
  Space,
  Typography,
  UploadProps,
} from 'antd';
import Dragger from 'antd/lib/upload/Dragger';
import { AxiosError } from 'axios';
import { isUndefined } from 'lodash';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ImportIcon } from '../../../assets/svg/ic-drag-drop.svg';
import { ReactComponent as SuccessBadgeIcon } from '../../../assets/svg/success-badge.svg';
import { STEPS_FOR_IMPORT_ENTITY } from '../../../constants/entity.constants';
import {
  CSVImportResult,
  Status,
} from '../../../generated/type/csvImportResult';
import { Transi18next } from '../../../utils/CommonUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import Stepper from '../../Settings/Services/Ingestion/IngestionStepper/IngestionStepper.component';
import Loader from '../Loader/Loader';
import './entity-import.style.less';
import { EntityImportProps } from './EntityImport.interface';
import { ImportStatus } from './ImportStatus/ImportStatus.component';

export const EntityImport = ({
  entityName,
  onImport,
  onSuccess,
  onCancel,
  children,
}: EntityImportProps) => {
  const { t } = useTranslation();

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>('');
  const [csvFileResult, setCsvFileResult] = useState<string>('');
  const [csvImportResult, setCsvImportResult] = useState<CSVImportResult>();
  const [activeStep, setActiveStep] = useState<number>(1);
  const [uploading, setUploading] = useState(false);
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
        setUploading(true);
        const response = await onImport(entityName, result);

        setCsvImportResult(response);
        setCsvFileResult(result);
        setActiveStep(2);
      }
    } catch (error) {
      setCsvImportResult(undefined);
    } finally {
      setUploading(false);
    }
  };

  const handleUpload: UploadProps['customRequest'] = (options) => {
    setIsLoading(true);
    try {
      const reader = new FileReader();

      reader.readAsText(options.file as Blob);

      reader.addEventListener('load', handleLoadData);

      reader.addEventListener('error', () => {
        throw t('server.unexpected-error');
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    setIsLoading(true);
    try {
      await onImport(entityName, csvFileResult, false);
      setActiveStep(3);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setCsvImportResult(undefined);
    setActiveStep(1);
  };

  return (
    <Row className="entity-import-container">
      <Col span={24}>
        <Stepper activeStep={activeStep} steps={STEPS_FOR_IMPORT_ENTITY} />
      </Col>
      {isLoading ? (
        <Col span={24}>
          <Loader />
        </Col>
      ) : (
        <>
          {activeStep === 1 && (
            <Col data-testid="upload-file-container" span={24}>
              {uploading ? (
                <Loader />
              ) : (
                <Dragger
                  accept=".csv"
                  beforeUpload={(file) => {
                    setFileName(file.name);
                  }}
                  className="file-dragger-wrapper p-lg bg-white"
                  customRequest={handleUpload}
                  data-testid="upload-file-widget"
                  multiple={false}
                  showUploadList={false}>
                  <Space
                    align="center"
                    className="w-full justify-center"
                    direction="vertical"
                    size={42}>
                    <ImportIcon height={86} width={86} />
                    <Typography.Text className="font-medium text-md">
                      <Transi18next
                        i18nKey="message.drag-and-drop-or-browse-csv-files-here"
                        renderElement={
                          <span className="text-primary browse-text" />
                        }
                        values={{
                          text: t('label.browse'),
                        }}
                      />
                    </Typography.Text>
                  </Space>
                </Dragger>
              )}
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
                        type="primary"
                        onClick={handleCancel}>
                        {t('label.back')}
                      </Button>
                      {!isFailure && (
                        <Button
                          data-testid="import-button"
                          loading={isLoading}
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
      )}
    </Row>
  );
};
