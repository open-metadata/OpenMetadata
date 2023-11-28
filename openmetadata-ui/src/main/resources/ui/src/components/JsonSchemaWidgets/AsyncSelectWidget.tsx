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
import { WidgetProps } from '@rjsf/utils';
import React, { useCallback } from 'react';
import { PAGE_SIZE_MEDIUM } from '../../constants/constants';
import { SearchIndex } from '../../enums/search.enum';
import { searchQuery } from '../../rest/searchAPI';
import { getEntityName } from '../../utils/EntityUtils';
import { AsyncSelect } from '../AsyncSelect/AsyncSelect';

const AsyncSelectWidget = ({
  onFocus,
  onBlur,
  onChange,
  schema,
  ...rest
}: WidgetProps) => {
  const type = rest?.uiSchema?.['ui:options']?.autoCompleteType as SearchIndex;

  const fetchEntities = useCallback(async (searchText: string) => {
    try {
      const res = await searchQuery({
        pageNumber: 1,
        pageSize: PAGE_SIZE_MEDIUM,
        searchIndex: type ?? SearchIndex.TABLE,
        query: searchText,
      });

      return res.hits.hits.map((value) => ({
        label: getEntityName(value._source),
        value: value._source.id,
      }));
    } catch (_) {
      return [];
    }
  }, []);

  return (
    <AsyncSelect
      api={fetchEntities}
      className="d-block"
      data-testid="edit-query-used-in"
      defaultValue={schema.value}
      mode="multiple"
      placeholder={schema.placeholder ?? ''}
      onChange={(value) => {
        onChange(value);
      }}
    />
  );
};

export default AsyncSelectWidget;
