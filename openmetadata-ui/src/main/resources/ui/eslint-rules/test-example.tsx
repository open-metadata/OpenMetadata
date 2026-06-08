/*
 *  Copyright 2025 Collate.
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

import { useEffect, useState } from 'react';
import { searchQuery } from '../src/rest/searchAPI';

// This is a test file to demonstrate the no-duplicate-api-calls rule

// BAD EXAMPLE - This will trigger warnings
export const BadComponent = () => {
  const [_data1, _setData1] = useState([]);
  const [_data2, _setData2] = useState([]);

  useEffect(() => {
    // First call to searchQuery
    searchQuery({
      query: '*',
      pageNumber: 1,
      pageSize: 10,
      searchIndex: 'table_search_index',
    }).then((res) => _setData1(res.data));
  }, []);

  useEffect(() => {
    // Duplicate call to searchQuery with same parameters
    searchQuery({
      query: '*',
      pageNumber: 1,
      pageSize: 10,
      searchIndex: 'table_search_index',
    }).then((res) => _setData2(res.data));
  }, []);

  return <div>Bad Component</div>;
};

// GOOD EXAMPLE - Single API call with shared state
export const GoodComponent = () => {
  const [_data, _setData] = useState([]);

  useEffect(() => {
    // Single call to searchQuery
    searchQuery({
      query: '*',
      pageNumber: 1,
      pageSize: 10,
      searchIndex: 'table_search_index',
    }).then((res) => _setData(res.data));
  }, []);

  return <div>Good Component</div>;
};
