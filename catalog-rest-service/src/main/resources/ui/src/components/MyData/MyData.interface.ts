import { EntityCounts, SearchDataFunctionType, SearchResponse } from 'Models';
import { User } from '../../generated/entity/teams/user';

export interface MyDataProps {
  error: string;
  countServices: number;
  userDetails: User;
  rejectedResult: PromiseRejectedResult['reason'][];
  errorHandler: (error: string) => void;
  searchResult: SearchResponse[] | undefined;
  fetchData: (value: SearchDataFunctionType) => void;
  entityCounts: EntityCounts;
}
