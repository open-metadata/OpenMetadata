import { AggregationType, Sterm } from 'Models';

export const getAggregationList = (
  aggregation: Record<string, Sterm>
): Array<AggregationType> => {
  const aggrEntriesArr = Object.entries(aggregation);
  const aggregationList: Array<AggregationType> = [];
  aggrEntriesArr.forEach((aggr) => {
    aggregationList.push({
      title: aggr[0].substring(aggr[0].indexOf('#') + 1),
      buckets: aggr[1].buckets,
    });
  });

  return aggregationList;
};
