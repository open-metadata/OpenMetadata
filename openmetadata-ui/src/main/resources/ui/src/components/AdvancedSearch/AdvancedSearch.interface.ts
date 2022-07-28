import { Config, ImmutableTree, QueryProps } from 'react-awesome-query-builder';

export interface AdvancedSearchProps {
  config: Config;
  tree: ImmutableTree;
  onChange: QueryProps['onChange'];
}
