import React, { useEffect, useMemo, useState } from 'react';
import {
  Builder,
  Config,
  Query,
  Utils as QbUtils,
} from 'react-awesome-query-builder';
import { elasticSearchFormat } from '../../utils/QueryBuilder';
import { AdvancedSearchProps } from './AdvancedSearch.interface';
import { emptyJsonTree, getQbConfigs } from './AdvancesSearch.constants';

const AdvancedSearch: React.FC<AdvancedSearchProps> = ({
  jsonTree = emptyJsonTree,
  onChangeJsonTree,
  onChangeQueryFilter,
  searchIndex,
}) => {
  const [config, setConfig] = useState<Config>(getQbConfigs(searchIndex));

  const immutableTree = useMemo(
    () => QbUtils.checkTree(QbUtils.loadTree(jsonTree), config),
    [jsonTree]
  );

  useEffect(() => setConfig(getQbConfigs(searchIndex)), [searchIndex]);

  useEffect(
    () =>
      onChangeQueryFilter({
        query: elasticSearchFormat(immutableTree, config),
      }),
    [immutableTree, config]
  );

  return (
    <Query
      {...config}
      renderBuilder={(props) => (
        <div className="query-builder-container">
          <div className="query-builder qb-lite">
            <Builder {...props} />
          </div>
        </div>
      )}
      value={immutableTree}
      onChange={(nTree, nConfig) => {
        setConfig(nConfig);
        onChangeJsonTree(QbUtils.getTree(nTree));
      }}
    />
  );
};

export default AdvancedSearch;
