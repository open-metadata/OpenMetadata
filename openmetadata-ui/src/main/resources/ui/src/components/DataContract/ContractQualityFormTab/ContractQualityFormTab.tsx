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
/* eslint-disable i18next/no-literal-string */
import { Card, Radio, Table, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const ContractQualityFormTab: React.FC = () => {
  const [testType, setTestType] = useState<'table' | 'column'>('table');

  const { t } = useTranslation();

  const columns = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
      },
      {
        title: t('label.status'),
        dataIndex: 'status',
      },
    ],
    [t]
  );

  return (
    <div className="container">
      <Typography.Title level={5}>{t('label.quality')}</Typography.Title>
      <Typography.Text type="secondary">
        {t('label.quality-description')}
      </Typography.Text>
      <Card>
        <Radio.Group
          value={testType}
          onChange={(e) => setTestType(e.target.value)}>
          <Radio.Button value="table">Table</Radio.Button>
          <Radio.Button value="column">Column</Radio.Button>
        </Radio.Group>
        <Table columns={columns} dataSource={[]} />
      </Card>
    </div>
  );
};
