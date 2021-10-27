import { EntityCounts, SearchDataFunctionType, SearchResponse } from 'Models';
import { User } from '../../generated/entity/teams/user';

export interface MyDataProps {
  countServices: number;
  userDetails: User;
  searchResult: SearchResponse | undefined;
  fetchData: (value: SearchDataFunctionType) => void;
  entityCounts: EntityCounts;
}
