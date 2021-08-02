import { AggregationType, Bucket } from 'Models';
import { tiers } from '../../constants/constants';

export const getBucketList = (buckets: Array<Bucket>) => {
  let bucketList: Array<Bucket> = [...tiers];
  buckets.forEach((el) => {
    bucketList = bucketList.map((tier) => {
      if (tier.key === el.key) {
        return el;
      } else {
        return tier;
      }
    });
  });

  return bucketList ?? [];
};

export const getAggrWithDefaultValue = (
  aggregations: Array<AggregationType>
) => {
  const aggregation = aggregations.find(
    (aggregation) => aggregation.title === 'Tier'
  );

  if (aggregation) {
    const index = aggregations.indexOf(aggregation);
    aggregations[index].buckets = getBucketList(aggregations[index].buckets);

    return aggregations;
  } else {
    return aggregations;
  }
};
