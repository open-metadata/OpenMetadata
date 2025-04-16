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

import { kebabCase, map } from 'lodash';
import loginClassBase from './LoginClassBase';

const {
  dataDiscovery,
  dataQuality,
  governance,
  dataInsightPlural,
  dataCollaboration,
  ...rest
} = loginClassBase.carouselImages();

export const LOGIN_SLIDE = [
  {
    title: 'data-discovery',
    image: dataDiscovery,
    descriptionKey: 'enables-end-to-end-metadata-management',
  },
  {
    title: 'data-quality',
    image: dataQuality,
    descriptionKey: 'discover-your-data-and-unlock-the-value-of-data-assets',
  },
  {
    title: 'governance',
    image: governance,
    descriptionKey: 'assess-data-reliability-with-data-profiler-lineage',
  },
  ...(dataInsightPlural
    ? [
        {
          title: 'data-insight-plural',
          image: dataInsightPlural,
          descriptionKey: 'fosters-collaboration-among-producers-and-consumers',
        },
      ]
    : map(rest, (item, key) => ({
        title: kebabCase(key),
        image: item,
        descriptionKey: kebabCase(key) + '-description',
      }))),
  {
    title: 'data-collaboration',
    image: dataCollaboration,
    descriptionKey: 'deeply-understand-table-relations-message',
  },
];
