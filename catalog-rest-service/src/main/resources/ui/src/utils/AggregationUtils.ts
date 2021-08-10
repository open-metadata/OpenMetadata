import { lowerCase } from 'lodash';
import { AggregationType, Sterm } from 'Models';

export const getAggregationList = (
  aggregation: Record<string, Sterm>,
  aggregationType = ''
): Array<AggregationType> => {
  const aggrEntriesArr = Object.entries(aggregation);
  const aggregationList: Array<AggregationType> = [];
  aggrEntriesArr.forEach((aggr) => {
    const aggrTitle = aggr[0].substring(aggr[0].indexOf('#') + 1);
    if (
      !aggregationType ||
      lowerCase(aggrTitle) === lowerCase(aggregationType)
    ) {
      aggregationList.push({
        title: aggrTitle,
        buckets: aggr[1].buckets,
      });
    }
  });

  return aggregationList;
};
