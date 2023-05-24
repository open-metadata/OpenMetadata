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

import KPIChart from 'components/DataInsightDetail/KPIChart';
import { INITIAL_CHART_FILTER } from 'constants/DataInsight.constants';
import { Kpi } from 'generated/dataInsight/kpi/kpi';
import React, { useEffect, useState } from 'react';
import { getListKPIs } from 'rest/KpiAPI';
import './kpi-widget.less';

const KPIWidget = () => {
  const [kpiList, setKpiList] = useState<Array<Kpi>>([]);

  const fetchKpiList = async () => {
    try {
      const response = await getListKPIs({ fields: 'dataInsightChart' });
      setKpiList(response.data);
    } catch (_err) {
      setKpiList([]);
    }
  };

  useEffect(() => {
    fetchKpiList();
  }, []);

  return (
    <div className="kpi-widget-container">
      <KPIChart chartFilter={INITIAL_CHART_FILTER} kpiList={kpiList} />
    </div>
  );
};

export default KPIWidget;
