import { FilterObject } from 'Models';
import { getCurrentUserId } from '../../utils/CommonUtils';
import { getFilterString } from '../../utils/FilterUtils';

export const myDataFilterType = [
  { key: 'Owned', value: 'owner' },
  { key: 'Following', value: 'followers' },
];

export const getFilters = (
  myDataFilters: Array<string>,
  filters: FilterObject
) => {
  const facetFilterString = getFilterString(filters);
  let myDataFilterString = '';
  myDataFilters.map((filter, index) => {
    myDataFilterString += `${filter}:${getCurrentUserId()}${
      index !== myDataFilters.length - 1 ? ' OR ' : ''
    }`;
  });

  return `${
    facetFilterString && myDataFilterString
      ? `${facetFilterString} AND (${myDataFilterString})`
      : myDataFilterString
      ? `(${myDataFilterString})`
      : `${facetFilterString}`
  }`;
};
