import { CreateDIChart } from '../generated/api/dataInsightNew/createDIChart';
import APIClient from './index';

export interface DiChartResultList {
  count: number;
  day: string;
  group: string;
}
export type postAggregateChartDataParams = {
  start: number;
  end: number;
};
// localhost:8585/api/v1/analytics/dataInsights_new/charts/preview?start=1715797800000&end=1717256219787
export const postAggregateChartData = async (
  params: postAggregateChartDataParams,
  data: CreateDIChart
) => {
  const response = await APIClient.post<DiChartResultList>(
    '/analytics/dataInsights_new/charts/preview',
    data,
    { params }
  );

  return response.data;
};
