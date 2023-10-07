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

import { AxiosError } from 'axios';
import React, { useEffect, useState } from 'react';
import KPIChartV1 from '../../components/DataInsightDetail/KPIChartV1';
import { CHART_WIDGET_DAYS_DURATION } from '../../constants/constants';
import { Kpi } from '../../generated/dataInsight/kpi/kpi';
import { getListKPIs } from '../../rest/KpiAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import './kpi-widget.less';

const KPIWidget = () => {
  const [kpiList, setKpiList] = useState<Array<Kpi>>([]);
  const [isKPIListLoading, setIsKPIListLoading] = useState<boolean>(false);

  const fetchKpiList = async () => {
    try {
      setIsKPIListLoading(true);
      const response = await getListKPIs({ fields: 'dataInsightChart' });
      setKpiList(response.data);
    } catch (_err) {
      setKpiList([]);
      showErrorToast(_err as AxiosError);
    } finally {
      setIsKPIListLoading(false);
    }
  };

  useEffect(() => {
    fetchKpiList().catch(() => {
      // catch handled in parent function
    });
  }, []);

  return (
    <div className="kpi-widget-container h-full">
      <KPIChartV1
        isKPIListLoading={isKPIListLoading}
        kpiList={kpiList}
        selectedDays={CHART_WIDGET_DAYS_DURATION}
      />
    </div>
  );
};

export default KPIWidget;
