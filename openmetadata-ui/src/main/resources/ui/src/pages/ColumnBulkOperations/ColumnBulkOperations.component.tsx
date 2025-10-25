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
import { Col, Row, Space, Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { ColumnBulkOperationsProps } from './ColumnBulkOperations.interface';
import './ColumnBulkOperations.less';
import ColumnGrid from './ColumnGrid/ColumnGrid.component';

const { Title, Paragraph } = Typography;

const ColumnBulkOperations = (props: ColumnBulkOperationsProps) => {
  const { t } = useTranslation();

  return (
    <PageLayoutV1 pageTitle={t('label.column-bulk-operations')}>
      <div className="column-bulk-operations-container">
        <div className="column-bulk-operations-header">
          <div>
            <Title level={3} className="m-b-xs">
              {t('label.column-bulk-operations')}
            </Title>
            <Paragraph className="text-grey-muted m-b-0">
              {t('message.column-bulk-operations-description')}
            </Paragraph>
          </div>
        </div>

        <ColumnGrid />
      </div>
    </PageLayoutV1>
  );
};

export default ColumnBulkOperations;
