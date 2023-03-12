/*
 *  Copyright 2022 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { Button, Modal, Space, Typography } from 'antd';
import { debounce, delay, isString } from 'lodash';
import Qs from 'qs';
import React, {
  FunctionComponent,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { JsonTree, Utils } from 'react-awesome-query-builder';
import { useTranslation } from 'react-i18next';
import { useHistory, useLocation } from 'react-router-dom';
import { SearchIndex } from '../../enums/search.enum';
import AdvancedSearch from '../AdvancedSearch/AdvancedSearch.component';

interface Props {
  visible: boolean;
  onSubmit: (
    filter: Record<string, unknown> | undefined,
    sqlFilter: string
  ) => void;
  onCancel: () => void;
  searchIndex: SearchIndex;
}

export const AdvancedSearchModal: FunctionComponent<Props> = ({
  visible,
  onSubmit,
  onCancel,
  searchIndex,
}: Props) => {
  const [queryFilter, setQueryFilter] = useState<
    Record<string, unknown> | undefined
  >();
  const [sqlFilter, setSQLFilter] = useState<string>('');

  const { t } = useTranslation();
  const history = useHistory();
  const location = useLocation();

  const parsedSearch = useMemo(
    () =>
      Qs.parse(
        location.search.startsWith('?')
          ? location.search.substr(1)
          : location.search
      ),
    [location.search]
  );

  const jsonTree = useMemo(() => {
    if (!isString(parsedSearch.queryFilter)) {
      return undefined;
    }

    try {
      const queryFilter = JSON.parse(parsedSearch.queryFilter);
      const immutableTree = Utils.loadTree(queryFilter as JsonTree);
      if (Utils.isValidTree(immutableTree)) {
        return queryFilter as JsonTree;
      }
    } catch {
      return undefined;
    }

    return undefined;
  }, [location.search]);

  const [treeInternal, setTreeInternal] = useState<JsonTree | undefined>(
    jsonTree
  );

  const handleTreeUpdate = useCallback(
    (tree?: JsonTree) => {
      history.push({
        pathname: history.location.pathname,
        search: Qs.stringify({
          ...parsedSearch,
          queryFilter: tree ? JSON.stringify(tree) : undefined,
          page: 1,
        }),
      });
      setTreeInternal(undefined);
    },
    [history, parsedSearch]
  );

  const handleAdvanceSearchReset = () => {
    delay(handleTreeUpdate, 100);
  };
  const handleQueryFilterUpdate = useCallback(
    (queryFilter: Record<string, unknown> | undefined, sqlFilter: string) => {
      setQueryFilter(queryFilter);
      setSQLFilter(sqlFilter);
    },
    [setQueryFilter, setSQLFilter]
  );

  return (
    <Modal
      closable
      destroyOnClose
      closeIcon={null}
      footer={
        <Space className="justify-between w-full">
          <Button
            className="float-right"
            size="small"
            onClick={handleAdvanceSearchReset}>
            {t('label.reset')}
          </Button>
          <div>
            <Button onClick={onCancel}>{t('label.cancel')}</Button>
            <Button
              type="primary"
              onClick={() => {
                handleTreeUpdate(treeInternal);
                onSubmit(queryFilter, sqlFilter);
                onCancel();
              }}>
              {t('label.apply')}
            </Button>
          </div>
        </Space>
      }
      okText={t('label.submit')}
      open={visible}
      title={t('label.advanced-entity', {
        entity: t('label.search'),
      })}
      width={950}
      onCancel={onCancel}>
      <Typography.Text data-testid="advanced-search-message">
        {t('message.advanced-search-message')}
      </Typography.Text>
      <AdvancedSearch
        jsonTree={treeInternal}
        searchIndex={searchIndex}
        onChangeJsonTree={debounce(setTreeInternal, 1)}
        onChangeQueryFilter={handleQueryFilterUpdate}
      />
    </Modal>
  );
};
