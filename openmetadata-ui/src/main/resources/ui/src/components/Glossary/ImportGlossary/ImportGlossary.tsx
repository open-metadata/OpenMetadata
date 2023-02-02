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
  Divider,
  Row,
  Space,
  Typography,
  Upload,
  UploadProps,
} from 'antd';
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

const { Dragger } = Upload;

const ImportGlossary: FC<Props> = ({ glossaryName }) => {
  const { t } = useTranslation();

  const history = useHistory();

  const [isLoading, setIsLoading] = useState<boolean>(false);

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

  const { isFailure, isAborted } = useMemo(() => {
    const status = csvImportResult?.status;

    const isFailure = status === Status.Failure;
    const isAborted = status === Status.Aborted;

    return {
      isFailure,
      isAborted,
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
      setActiveStep(3);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGlossaryRedirection = () => {
    history.push(getGlossaryPath(glossaryName));
  };

  const handleCancel = () => {
    setCsvImportResult(undefined);
    setActiveStep(1);
  };

  return (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <TitleBreadcrumb titleLinks={breadcrumbList} />
      </Col>
      <Col span={24}>
        <Typography.Title data-testid="title" level={5}>
          {t('label.import-glossary-terms')}
        </Typography.Title>
      </Col>
      <Col span={24}>
        <Stepper
          activeStep={activeStep}
          steps={STEPS_FOR_IMPORT_GLOSSARY_TERMS}
        />
      </Col>
      {isLoading ? (
        <Loader />
      ) : (
        <Col span={24}>
          {activeStep === 1 && (
            <>
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
              </Dragger>
              <Affix className="bg-white p-md glossary-preview-footer">
                <Space className="justify-end w-full p-r-md">
                  <Button
                    ghost
                    data-testid="cancel"
                    type="primary"
                    onClick={handleGlossaryRedirection}>
                    {t('label.cancel')}
                  </Button>
                </Space>
              </Affix>
            </>
          )}
          {activeStep === 2 && !isUndefined(csvImportResult) && (
            <>
              {isAborted ? (
                <Card>
                  <Space
                    align="center"
                    className="w-full justify-center p-lg"
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
                <div className="mb-16">
                  <ImportResult csvImportResult={csvImportResult} />
                  <Affix className="bg-white p-md glossary-preview-footer">
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
            </>
          )}

          {activeStep > 2 && (
            <Card>
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
                    onClick={handleGlossaryRedirection}>
                    {t('label.view')}
                  </Button>
                </Space>
              </Space>
            </Card>
          )}
        </Col>
      )}
    </Row>
  );
};

export default ImportGlossary;
