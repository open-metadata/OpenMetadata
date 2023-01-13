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
import { ReactComponent as BrowseFileIcon } from 'assets/svg/ic-browse-file.svg';
import { ReactComponent as ImportIcon } from 'assets/svg/ic-import.svg';
import { ReactComponent as SuccessBadgeIcon } from 'assets/svg/success-badge.svg';
import { AxiosError } from 'axios';
import TitleBreadcrumb from 'components/common/title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from 'components/common/title-breadcrumb/title-breadcrumb.interface';
import Loader from 'components/Loader/Loader';
import { CSVImportResult } from 'generated/type/csvImportResult';
import { isUndefined } from 'lodash';
import React, { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { importGlossaryInCSVFormat } from 'rest/glossaryAPI';
import { getGlossaryPath } from 'utils/RouterUtils';
import { showErrorToast } from 'utils/ToastUtils';
import './ImportGlossary.less';

interface Props {
  glossaryName: string;
}

const { Title } = Typography;
const { Dragger } = Upload;

const ImportGlossary: FC<Props> = ({ glossaryName }) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>('');
  const [csvImportResult, setCsvImportResult] = useState<CSVImportResult>();

  const breadcrumbList: TitleBreadcrumbProps['titleLinks'] = [
    {
      name: glossaryName,
      url: getGlossaryPath(glossaryName),
    },
    {
      name: 'Import Glossary Terms',
      url: '',
      activeTitle: true,
    },
  ];

  const handleUpload: UploadProps['customRequest'] = async (options) => {
    setIsLoading(true);
    try {
      const reader = new FileReader();
      reader.readAsText(options.file as Blob);
      reader.addEventListener('load', async (e) => {
        const result = e.target?.result;
        if (result) {
          const response = await importGlossaryInCSVFormat(
            glossaryName,
            result as string
          );

          setCsvImportResult(response);
        }
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <TitleBreadcrumb titleLinks={breadcrumbList} />
      <Row gutter={[16, 16]}>
        <Col>
          <Title level={5}>Import Glossary Terms</Title>
        </Col>
        <Col span={24}>
          {isUndefined(csvImportResult) ? (
            <Dragger
              accept=".csv"
              beforeUpload={(file) => {
                setIsLoading(true);
                setFileName(file.name);
              }}
              className="file-dragger-wrapper p-lg"
              customRequest={handleUpload}
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
                    <Typography.Text>Drag & drop files here</Typography.Text>
                  </Space>
                  <Divider plain>
                    <Typography.Text type="secondary">
                      {t('label.or-lowercase')}
                    </Typography.Text>
                  </Divider>
                  <Button>
                    <Space>
                      <BrowseFileIcon width={16} />
                      <Typography.Text className="text-primary">
                        Browse csv file
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
                <SuccessBadgeIcon width={58} />
                <Typography.Text>
                  <strong>{fileName}</strong> is ready for preview.
                </Typography.Text>
                <Space size={16}>
                  <Button onClick={() => setCsvImportResult(undefined)}>
                    {t('label.cancel')}
                  </Button>
                  <Button type="primary">{t('label.preview')}</Button>
                </Space>
              </Space>
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
};

export default ImportGlossary;
