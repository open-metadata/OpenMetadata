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
  Button,
  Card,
  Col,
  Divider,
  Row,
  Space,
  Typography,
  Upload,
  UploadProps,
} from 'antd';
import { ReactComponent as FailBadgeIcon } from 'assets/svg/fail-badge.svg';
import { ReactComponent as BrowseFileIcon } from 'assets/svg/ic-browse-file.svg';
import { ReactComponent as ImportIcon } from 'assets/svg/ic-import.svg';
import { ReactComponent as SuccessBadgeIcon } from 'assets/svg/success-badge.svg';
import { AxiosError } from 'axios';
import TitleBreadcrumb from 'components/common/title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from 'components/common/title-breadcrumb/title-breadcrumb.interface';
import Stepper from 'components/IngestionStepper/IngestionStepper.component';
import Loader from 'components/Loader/Loader';
import { STEPS_FOR_IMPORT_GLOSSARY_TERMS } from 'constants/Glossary.constant';
import { CSVImportResult, Status } from 'generated/type/csvImportResult';
import { isUndefined } from 'lodash';
import React, { FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { importGlossaryInCSVFormat } from 'rest/glossaryAPI';
import { getGlossaryPath } from 'utils/RouterUtils';
import { showErrorToast } from 'utils/ToastUtils';
import ImportResult from '../ImportResult/ImportResult';
import './ImportGlossary.less';

interface Props {
  glossaryName: string;
}

const { Title } = Typography;
const { Dragger } = Upload;

const ImportGlossary: FC<Props> = ({ glossaryName }) => {
  const { t } = useTranslation();

  const history = useHistory();

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPreview, setIsPreview] = useState<boolean>(false);

  const [fileName, setFileName] = useState<string>('');

  const [csvFileResult, setCsvFileResult] = useState<string>('');

  const [csvImportResult, setCsvImportResult] = useState<CSVImportResult>();
  const [activeStep, setActiveStep] = useState<number>(1);

  const breadcrumbList: TitleBreadcrumbProps['titleLinks'] = useMemo(
    () => [
      {
        name: glossaryName,
        url: getGlossaryPath(glossaryName),
      },
      {
        name: t('label.import-glossary-terms'),
        url: '',
        activeTitle: true,
      },
    ],
    [glossaryName]
  );

  const {
    isSuccess,
    isFailure,
    isAborted,
    showAbortedResult,
    showSuccessResult,
    steps,
  } = useMemo(() => {
    const status = csvImportResult?.status;

    const isSuccess =
      status === Status.Success || status === Status.PartialSuccess;
    const isFailure = status === Status.Failure;
    const isAborted = status === Status.Aborted;

    const showAbortedResult = isAborted;
    const showSuccessResult = isSuccess || isFailure;

    const steps =
      isUndefined(csvImportResult) || isSuccess
        ? STEPS_FOR_IMPORT_GLOSSARY_TERMS
        : STEPS_FOR_IMPORT_GLOSSARY_TERMS.slice(0, 2);

    return {
      isSuccess,
      isFailure,
      isAborted,
      showAbortedResult,
      showSuccessResult,
      steps,
    };
  }, [csvImportResult]);

  const handleUpload: UploadProps['customRequest'] = async (options) => {
    setIsLoading(true);
    try {
      const reader = new FileReader();

      reader.readAsText(options.file as Blob);

      reader.addEventListener('load', async (e) => {
        const result = e.target?.result as string;
        if (result) {
          const response = await importGlossaryInCSVFormat(
            glossaryName,
            result
          );

          setCsvImportResult(response);
          setCsvFileResult(result);
          setActiveStep(2);
        }
      });

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
      await importGlossaryInCSVFormat(glossaryName, csvFileResult, false);

      history.push(getGlossaryPath(glossaryName));
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreview = () => {
    setIsPreview(true);
    setActiveStep(3);
  };

  const handleCancel = () => {
    setCsvImportResult(undefined);
    setActiveStep(1);
    setIsPreview(false);
  };

  return (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <TitleBreadcrumb titleLinks={breadcrumbList} />
      </Col>
      <Col span={24}>
        <Space className="w-full justify-between">
          <Title data-testid="title" level={5}>
            {isPreview ? glossaryName : t('label.import-glossary-terms')}
          </Title>
          {isPreview && !isUndefined(csvImportResult) && (
            <>
              {!isFailure && !isAborted && (
                <Button
                  data-testid="import-button"
                  loading={isLoading}
                  type="primary"
                  onClick={handleImport}>
                  {t('label.import')}
                </Button>
              )}
              {(isFailure || isAborted) && (
                <Button
                  data-testid="preview-cancel-button"
                  type="primary"
                  onClick={handleCancel}>
                  {t('label.cancel')}
                </Button>
              )}
            </>
          )}
        </Space>
      </Col>
      <Col span={24}>
        <Stepper activeStep={activeStep} steps={steps} />
      </Col>
      {isPreview && !isUndefined(csvImportResult) ? (
        <Col span={24}>
          <ImportResult csvImportResult={csvImportResult} />
        </Col>
      ) : (
        <Col span={24}>
          {isUndefined(csvImportResult) ? (
            <Dragger
              accept=".csv"
              beforeUpload={(file) => {
                setIsLoading(true);
                setFileName(file.name);
              }}
              className="file-dragger-wrapper p-lg bg-white"
              customRequest={handleUpload}
              data-testid="upload-file-widget"
              multiple={false}
              showUploadList={false}>
              {isLoading ? (
                <Loader />
              ) : (
                <>
                  <Space
                    align="center"
                    className="w-full justify-center"
                    direction="vertical"
                    size={16}>
                    <ImportIcon height={58} width={58} />
                    <Typography.Text>
                      {t('label.drag-and-drop-files-here')}
                    </Typography.Text>
                  </Space>
                  <Divider plain>
                    <Typography.Text type="secondary">
                      {t('label.or-lowercase')}
                    </Typography.Text>
                  </Divider>
                  <Button data-testid="upload-button">
                    <Space>
                      <BrowseFileIcon width={16} />
                      <Typography.Text className="text-primary">
                        {t('label.browse-csv-file')}
                      </Typography.Text>
                    </Space>
                  </Button>
                </>
              )}
            </Dragger>
          ) : (
            <Card>
              <Space
                align="center"
                className="w-full justify-center p-lg"
                direction="vertical"
                size={16}>
                {isSuccess && (
                  <SuccessBadgeIcon data-testid="success-badge" width={58} />
                )}
                {isFailure && (
                  <FailBadgeIcon data-testid="failure-badge" width={58} />
                )}

                {showSuccessResult && (
                  <>
                    <Typography.Text>
                      <strong data-testid="file-name">{fileName}</strong>{' '}
                      {`${t('label.is-ready-for-preview')}.`}
                    </Typography.Text>
                    <Space size={16}>
                      <Button
                        data-testid="cancel-button"
                        onClick={handleCancel}>
                        {t('label.cancel')}
                      </Button>
                      <Button
                        data-testid="preview-button"
                        type="primary"
                        onClick={handlePreview}>
                        {t('label.preview')}
                      </Button>
                    </Space>
                  </>
                )}

                {showAbortedResult && (
                  <>
                    <Typography.Text
                      className="text-center"
                      data-testid="abort-reason">
                      <strong className="d-block">{t('label.aborted')}</strong>{' '}
                      {csvImportResult.abortReason}
                    </Typography.Text>
                    <Space size={16}>
                      <Button
                        data-testid="cancel-button"
                        onClick={handleCancel}>
                        {t('label.cancel')}
                      </Button>
                      <Button
                        data-testid="preview-button"
                        type="primary"
                        onClick={handlePreview}>
                        {t('label.preview')}
                      </Button>
                    </Space>
                  </>
                )}
              </Space>
            </Card>
          )}
        </Col>
      )}
    </Row>
  );
};

export default ImportGlossary;
