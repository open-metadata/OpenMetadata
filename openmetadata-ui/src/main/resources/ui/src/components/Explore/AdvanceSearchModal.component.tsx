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
import { delay } from 'lodash';
import React, { FunctionComponent, useState } from 'react';
import { JsonTree } from 'react-awesome-query-builder';
import { useTranslation } from 'react-i18next';
import { SearchIndex } from '../../enums/search.enum';
import AdvancedSearch from '../AdvancedSearch/AdvancedSearch.component';

interface Props {
  visible: boolean;
  onSubmit: (filter?: Record<string, unknown>) => void;
  onCancel: () => void;
  searchIndex: SearchIndex;
  onChangeJsonTree: (tree?: JsonTree) => void;
  jsonTree?: JsonTree;
  onAppliedFilterChange: (value: string) => void;
}

export const AdvancedSearchModal: FunctionComponent<Props> = ({
  visible,
  onSubmit,
  onCancel,
  searchIndex,
  onChangeJsonTree,
  jsonTree,
  onAppliedFilterChange,
}: Props) => {
  const [queryFilter, setQueryFilter] = useState<
    Record<string, unknown> | undefined
  >();

  const { t } = useTranslation();

  const handleAdvanceSearchReset = () => {
    delay(onChangeJsonTree, 100);
  };

  return (
    <Modal
      destroyOnClose
      closable={false}
      footer={
        <Space className="justify-between w-full">
          <Button
            className="float-right"
            size="small"
            onClick={handleAdvanceSearchReset}>
            Reset
          </Button>
          <div>
            <Button onClick={onCancel}>Cancel</Button>
            <Button
              type="primary"
              onClick={() => {
                onSubmit(queryFilter);
                onCancel();
              }}>
              Apply
            </Button>
          </div>
        </Space>
      }
      okText={t('label.submit')}
      open={visible}
      title={t('label.advanced-entity', {
        entity: t('label.search'),
      })}
      width={950}>
      <Typography.Text data-testid="advanced-search-message">
        {t('message.advanced-search-message')}
      </Typography.Text>
      <AdvancedSearch
        jsonTree={jsonTree}
        searchIndex={searchIndex}
        onAppliedFilterChange={onAppliedFilterChange}
        onChangeJsonTree={(nTree) => onChangeJsonTree(nTree)}
        onChangeQueryFilter={setQueryFilter}
      />
    </Modal>
  );
};
