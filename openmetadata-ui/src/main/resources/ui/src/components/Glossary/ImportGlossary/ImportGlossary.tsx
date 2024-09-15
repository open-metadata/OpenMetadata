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
import { Col, Row, Typography } from 'antd';
import { AxiosError } from 'axios';
import React, { FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { CSVImportResult } from '../../../generated/type/csvImportResult';
import { importGlossaryInCSVFormat } from '../../../rest/glossaryAPI';
import { getGlossaryPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { EntityImport } from '../../common/EntityImport/EntityImport.component';
import TitleBreadcrumb from '../../common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../common/TitleBreadcrumb/TitleBreadcrumb.interface';
import { GlossaryImportResult } from '../ImportResult/GlossaryImportResult.component';
import './import-glossary.less';

interface Props {
  glossaryName: string;
}

const ImportGlossary: FC<Props> = ({ glossaryName }) => {
  const { t } = useTranslation();
  const history = useHistory();
  const [csvImportResult, setCsvImportResult] = useState<CSVImportResult>();

  const breadcrumbList: TitleBreadcrumbProps['titleLinks'] = useMemo(
    () => [
      {
        name: t('label.glossary-plural'),
        url: getGlossaryPath(),
        activeTitle: false,
      },
      {
        name: glossaryName,
        url: getGlossaryPath(glossaryName),
      },
    ],
    [glossaryName]
  );

  const handleGlossaryRedirection = () => {
    history.push(getGlossaryPath(glossaryName));
  };

  const handleImportCsv = async (name: string, data: string, dryRun = true) => {
    try {
      const response = await importGlossaryInCSVFormat(name, data, dryRun);
      setCsvImportResult(response);

      return response;
    } catch (error) {
      showErrorToast(error as AxiosError);

      return;
    }
  };

  return (
    <Row className="import-glossary p-x-md" gutter={[16, 8]}>
      <Col span={24}>
        <TitleBreadcrumb titleLinks={breadcrumbList} />
      </Col>
      <Col span={24}>
        <Typography.Title data-testid="title" level={5}>
          {t('label.import-entity', {
            entity: t('label.glossary-term-plural'),
          })}
        </Typography.Title>
      </Col>
      <Col span={24}>
        <EntityImport
          entityName={glossaryName}
          onCancel={handleGlossaryRedirection}
          onImport={handleImportCsv}
          onSuccess={handleGlossaryRedirection}>
          {csvImportResult ? (
            <GlossaryImportResult csvImportResult={csvImportResult} />
          ) : (
            <></>
          )}
        </EntityImport>
      </Col>
    </Row>
  );
};

export default ImportGlossary;
