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
import { Space, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { CSVImportResult } from '../../../../generated/type/csvImportResult';
interface ImportStatusProps {
  csvImportResult: CSVImportResult;
}

export const ImportStatus = ({ csvImportResult }: ImportStatusProps) => {
  const { t } = useTranslation();

  return (
    <Space>
      <div>
        <Typography.Text type="secondary">{`${t(
          'label.number-of-rows'
        )}: `}</Typography.Text>
        <span className="font-semibold" data-testid="processed-row">
          {csvImportResult.numberOfRowsProcessed}
        </span>
      </div>
      {' | '}
      <div>
        <Typography.Text type="secondary">{`${t(
          'label.passed'
        )}: `}</Typography.Text>
        <span className="font-semibold passed-row" data-testid="passed-row">
          {csvImportResult.numberOfRowsPassed}
        </span>
      </div>
      {' | '}
      <div>
        <Typography.Text type="secondary">{`${t(
          'label.failed'
        )}: `}</Typography.Text>
        <span className="font-semibold failed-row" data-testid="failed-row">
          {csvImportResult.numberOfRowsFailed}
        </span>
      </div>
    </Space>
  );
};
