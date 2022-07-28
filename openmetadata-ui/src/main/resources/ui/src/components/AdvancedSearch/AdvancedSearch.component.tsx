import React from 'react';
import { Builder, Query } from 'react-awesome-query-builder';
import { AdvancedSearchProps } from './AdvancedSearch.interface';

const AdvancedSearch: React.FC<AdvancedSearchProps> = ({
  config,
  tree,
  onChange,
}) => (
  <Query
    {...config}
    renderBuilder={(props) => (
      <div className="query-builder-container">
        <div className="query-builder qb-lite">
          <Builder {...props} />
        </div>
      </div>
    )}
    value={tree}
    onChange={onChange}
  />
);

export default AdvancedSearch;
