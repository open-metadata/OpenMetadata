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

import { Col, Row } from 'antd';
import { t } from 'i18next';
import { lowerCase } from 'lodash';
import React, { FunctionComponent, useState } from 'react';
import Searchbar from '../../common/SearchBarComponent/SearchBar.component';
import SchemaTable from '../SchemaTable/SchemaTable.component';
import { Props } from './SchemaTab.interfaces';

const SchemaTab: FunctionComponent<Props> = ({
  onUpdate,
  hasDescriptionEditAccess,
  hasTagEditAccess,
  hasGlossaryTermEditAccess,
  onThreadLinkSelect,
  isReadOnly = false,
}: Props) => {
  const [searchText, setSearchText] = useState('');

  const handleSearchAction = (searchValue: string) => {
    setSearchText(searchValue);
  };

  return (
    <Row gutter={[16, 16]}>
      <Col span={8}>
        <Searchbar
          removeMargin
          placeholder={t('message.find-in-table')}
          searchValue={searchText}
          typingInterval={500}
          onSearch={handleSearchAction}
        />
      </Col>
      <Col span={24}>
        <SchemaTable
          hasDescriptionEditAccess={hasDescriptionEditAccess}
          hasGlossaryTermEditAccess={hasGlossaryTermEditAccess}
          hasTagEditAccess={hasTagEditAccess}
          isReadOnly={isReadOnly}
          searchText={lowerCase(searchText)}
          onThreadLinkSelect={onThreadLinkSelect}
          onUpdate={onUpdate}
        />
      </Col>
    </Row>
  );
};

export default SchemaTab;
