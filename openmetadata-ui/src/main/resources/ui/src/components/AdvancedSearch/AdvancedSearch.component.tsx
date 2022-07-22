import React, { useState } from 'react';
import {
  BasicConfig,
  Builder,
  Config,
  Fields,
  ImmutableTree,
  Query,
  Utils as QbUtils,
} from 'react-awesome-query-builder';
import AntdConfig from 'react-awesome-query-builder/lib/config/antd';
import { getAdvancedFieldOptions } from '../../axiosAPIs/miscAPI';
import { SearchIndex } from '../../enums/search.enum';
import { AxiosError } from 'axios';
import { showErrorToast } from '../../utils/ToastUtils';
import { AdvancedFields } from '../../enums/AdvancedSearch.enum';

const AdvancedSearch: React.FC = () => {
  // Choose your skin (ant/material/vanilla):
  const InitialConfig = AntdConfig as BasicConfig; // or MaterialConfig or BasicConfig

  const fields: Fields = {
    service: {
      label: 'Service',
      type: 'multiselect',
      fieldSettings: {
        showSearch: true,
        showCheckboxes: true,
        useAsyncSearch: true,
        useLoadMore: false,
        asyncFetch: (search) =>
          getAdvancedFieldOptions(
            search ?? '*',
            SearchIndex.TABLE,
            AdvancedFields.SERVICE
          )
            .then((resp) => ({
              values: (
                resp.data.suggest['metadata-suggest'][0].options ?? []
              ).map((op) => ({
                value: op.text,
                title: op.text,
              })),
              hasMore: false,
            }))
            .catch((err: AxiosError) => {
              showErrorToast(err);

              return Promise.resolve({
                values: [],
                hasMore: false,
              });
            }),
      },
      excludeOperators: ['is_null', 'is_not_null'],
      valueSources: ['value'],
    },
    database: {
      label: 'Database',
      type: 'multiselect',
      fieldSettings: {
        showSearch: true,
        showCheckboxes: true,
        useAsyncSearch: true,
        useLoadMore: false,
        asyncFetch: (search) =>
          getAdvancedFieldOptions(
            search ?? '*',
            SearchIndex.TABLE,
            AdvancedFields.DATABASE
          )
            .then((resp) => ({
              values: (
                resp.data.suggest['metadata-suggest'][0].options ?? []
              ).map((op) => ({
                value: op.text,
                title: op.text,
              })),
              hasMore: false,
            }))
            .catch((err: AxiosError) => {
              showErrorToast(err);

              return Promise.resolve({
                values: [],
                hasMore: false,
              });
            }),
      },
      excludeOperators: ['is_null', 'is_not_null'],
      valueSources: ['value'],
    },
  };

  const initialConfig = {
    ...InitialConfig,
    types: {
      ...InitialConfig.types,
      multiselect: {
        ...InitialConfig.types.multiselect,
        widgets: {
          ...InitialConfig.types.multiselect.widgets,
          text: {
            operators: ['like', 'not_like'],
          },
        },
      },
    },
    fields,
  };

  // You can load query value from your backend storage (for saving see `Query.onChange()`)
  const [{ tree, config }, setState] = useState<{
    tree: ImmutableTree;
    config: Config;
  }>({
    tree: QbUtils.checkTree(
      QbUtils.loadTree({ id: QbUtils.uuid(), type: 'group' }),
      initialConfig
    ),
    config: initialConfig,
  });

  return (
    <div>
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
        onChange={(immutableTree, config) => {
          setState((pre) => ({
            ...pre,
            tree: immutableTree,
            config,
            jsonTree: QbUtils.getTree(immutableTree),
          }));
        }}
      />
      <p className="tw-my-3">
        {JSON.stringify(QbUtils.getTree(tree), null, 2)}
      </p>
      <p className="tw-my-3">{QbUtils.queryString(tree, config, true)}</p>
      <p className="tw-my-3">
        {JSON.stringify(QbUtils.elasticSearchFormat(tree, config), null, 2)}
      </p>
    </div>
  );
};

export default AdvancedSearch;
