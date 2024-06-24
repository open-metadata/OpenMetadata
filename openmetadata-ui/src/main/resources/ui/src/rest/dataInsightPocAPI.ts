import { CreateDIChart } from '../generated/api/dataInsightNew/createDIChart';
import APIClient from './index';

export interface DiChartResultList {
  results: { count: number; day: string; group: string }[];
}
export type postAggregateChartDataParams = {
  start: number;
  end: number;
};

export const postAggregateChartData = async (
  params: postAggregateChartDataParams,
  data: CreateDIChart
) => {
  const response = await APIClient.post<DiChartResultList>(
    '/analytics/dataInsights/custom/charts/preview',
    data,
    { params }
  );

  return response.data;
};
