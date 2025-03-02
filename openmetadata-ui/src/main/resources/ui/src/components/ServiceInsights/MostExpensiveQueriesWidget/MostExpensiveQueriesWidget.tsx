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
import { Card, Typography } from 'antd';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Query } from '../../../generated/entity/data/query';
import { getMostExpensiveQueriesWidgetColumns } from '../../../utils/MostExpensiveQueriesWidgetUtils';
import Table from '../../common/Table/Table';
import './most-expensive-queries-widget.less';

function MostExpensiveQueriesWidget() {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [queryData, setQueryData] = useState<Array<Query>>([]);

  const columns = useMemo(() => getMostExpensiveQueriesWidgetColumns(), []);

  return (
    <div className="service-insights-widget">
      <Card className="most-expensive-queries-widget">
        <div className="flex flex-col gap-1 p-lg">
          <Typography.Text className="font-medium text-lg">
            {t('label.most-expensive-query-plural')}
          </Typography.Text>
          <Typography.Text className="text-grey-muted text-sm">
            {t('message.most-expensive-queries-widget-description')}
          </Typography.Text>
        </div>
        <Table
          className="most-expensive-queries-widget-table"
          columns={columns}
          dataSource={queryData}
          loading={isLoading}
          pagination={false}
        />
      </Card>
    </div>
  );
}

export default MostExpensiveQueriesWidget;
