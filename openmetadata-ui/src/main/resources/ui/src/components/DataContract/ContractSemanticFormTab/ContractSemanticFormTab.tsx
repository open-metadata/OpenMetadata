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
import { Card, Collapse, Typography } from 'antd';
import { useTranslation } from 'react-i18next';

export const ContractSemanticFormTab = () => {
  const { t } = useTranslation();

  return (
    <div className="container">
      <Typography.Title level={5}>{t('label.semantics')}</Typography.Title>
      <Typography.Text type="secondary">
        {t('label.semantics-description')}
      </Typography.Text>
      <Collapse>
        <Collapse.Panel header="Table checks configuration" key="table-checks">
          <Card>Table checks confirguration</Card>
        </Collapse.Panel>
        <Collapse.Panel
          header="Column checks configuration"
          key="column-checks">
          <Card>Column checks configuration</Card>
        </Collapse.Panel>
      </Collapse>
    </div>
  );
};
