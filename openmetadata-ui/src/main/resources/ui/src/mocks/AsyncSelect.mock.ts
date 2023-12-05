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
const getOptions = (initialValue: number, endValue: number) => {
  const data = [];

  for (let i = initialValue; i < endValue; i++) {
    data.push({
      label: `tags-${i}`,
      value: `tags-${i}`,
      data: {
        fullyQualifiedName: `tags-${i}`,
      },
    });
  }

  return data;
};

export const ASYNC_SELECT_MOCK = {
  data: getOptions(0, 10),
  paging: {
    total: 20,
  },
};
