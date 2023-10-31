/*
 *  Copyright 2023 Collate.
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
import Icon from '@ant-design/icons';
import { Col, Radio, Row } from 'antd';
import { isEmpty } from 'lodash';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as GridIcon } from '../../assets/svg/ic-grid.svg';
import { ReactComponent as ListIcon } from '../../assets/svg/ic-list.svg';
import Table from '../../components/common/Table/Table';
import Searchbar from '../common/SearchBarComponent/SearchBar.component';
import { ListViewOptions, ListViewProps } from './ListView.interface';

// eslint-disable-next-line @typescript-eslint/ban-types, @typescript-eslint/no-explicit-any
export const ListView = <T extends object = any>({
  tableprops,
  cardRenderer,
  searchProps: { search, onSearch },
}: ListViewProps<T>) => {
  const [currentView, setCurrentView] = useState<ListViewOptions>(
    ListViewOptions.TABLE
  );
  const { t } = useTranslation();

  const cardRender = useMemo(() => {
    if (isEmpty(tableprops.dataSource)) {
      return tableprops.locale?.emptyText;
    }

    return (
      <Row gutter={[16, 16]}>
        {(tableprops.dataSource ?? []).map((dataSource) =>
          cardRenderer(dataSource)
        )}
      </Row>
    );
  }, [tableprops, cardRenderer]);

  return (
    <Row gutter={[16, 16]}>
      <Col span={10}>
        <Searchbar
          removeMargin
          placeholder={t('label.search-entity', {
            entity: t('label.service-plural'),
          })}
          searchValue={search}
          onSearch={onSearch}
        />
      </Col>
      <Col className="text-right" span={14}>
        <Radio.Group
          value={currentView}
          onChange={(e) => setCurrentView(e.target.value)}>
          <Radio.Button value={ListViewOptions.CARD}>
            <Icon component={GridIcon} data-testid="grid" />
          </Radio.Button>
          <Radio.Button value={ListViewOptions.TABLE}>
            <Icon component={ListIcon} data-testid="list" />
          </Radio.Button>
        </Radio.Group>
      </Col>
      <Col span={24}>
        {currentView === ListViewOptions.TABLE ? (
          <Table {...tableprops} />
        ) : (
          cardRender
        )}
      </Col>
    </Row>
  );
};
