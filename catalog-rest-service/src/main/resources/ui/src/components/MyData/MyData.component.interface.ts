import { SearchDataFunctionType, SearchResponse } from 'Models';
import { User } from '../../generated/entity/teams/user';

export interface MyDataProps {
  countServices: number;
  userDetails: User;
  error: string;
  searchResult: SearchResponse | undefined;
  fetchData: (value: SearchDataFunctionType) => void;
}
