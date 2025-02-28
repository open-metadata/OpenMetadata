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
import { AxiosError } from 'axios';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PAGE_SIZE_SMALL } from '../../../constants/constants';
import { SearchIndex } from '../../../enums/search.enum';
import { Table as TableType } from '../../../generated/entity/data/table';
import { useFqn } from '../../../hooks/useFqn';
import { searchQuery } from '../../../rest/searchAPI';
import Fqn from '../../../utils/Fqn';
import { getMostUsedAssetsWidgetColumns } from '../../../utils/MostUsedAssetsWidgetUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import Table from '../../common/Table/Table';
import './most-used-assets-widget.less';

function MostUsedAssetsWidget() {
  const { t } = useTranslation();
  const { fqn: serviceName } = useFqn();
  const [isLoading, setIsLoading] = useState(false);
  const [tableData, setTableData] = useState<Array<TableType>>([]);
  const nameWithoutQuotes = Fqn.getNameWithoutQuotes(serviceName);

  const getTableData = async () => {
    setIsLoading(true);
    try {
      const response = await searchQuery({
        pageSize: PAGE_SIZE_SMALL,
        queryFilter: {
          query: {
            bool: {
              must: [{ term: { 'service.name.keyword': nameWithoutQuotes } }],
            },
          },
        },
        searchIndex: SearchIndex.TABLE,
        trackTotalHits: true,
        sortField: 'usageSummary.weeklyStats.percentileRank',
        sortOrder: 'desc',
      });
      const data = response.hits.hits.map((schema) => schema._source);
      setTableData(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const columns = useMemo(() => getMostUsedAssetsWidgetColumns(), []);

  useEffect(() => {
    getTableData();
  }, []);

  return (
    <div className="service-insights-widget">
      <Card className="most-used-assets-widget">
        <div className="flex flex-col gap-1 p-lg">
          <Typography.Text className="font-medium text-lg">
            {t('label.most-used-data-assets')}
          </Typography.Text>
          <Typography.Text className="text-grey-muted">
            {t('message.most-used-assets-widget-description')}
          </Typography.Text>
        </div>
        <Table
          className="most-used-assets-widget-table"
          columns={columns}
          dataSource={tableData}
          loading={isLoading}
          pagination={false}
        />
      </Card>
    </div>
  );
}

export default MostUsedAssetsWidget;
