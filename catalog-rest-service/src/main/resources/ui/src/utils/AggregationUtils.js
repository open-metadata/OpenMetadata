export const getAggregationList = (aggregation) => {
  const aggrEntriesArr = Object.entries(aggregation);
  const aggregationList = [];
  aggrEntriesArr.forEach((aggr) => {
    aggregationList.push({
      title: aggr[0].substring(aggr[0].indexOf('#') + 1),
      buckets: aggr[1].buckets,
    });
  });

  return aggregationList;
};
