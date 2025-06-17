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

export const observerOptions = {
  root: null,
  rootMargin: '0px',
  threshold: 1.0,
};

export const DEFAULT_HEADER_BG_COLOR =
  'linear-gradient(106.44deg, #1568DA 0.76%, rgba(33, 93, 243, 0.9) 47.51%, #2196F3 115.4%)';

export const headerBackgroundColors = [
  {
    label: 'Gray',
    color: '#535862',
  },
  {
    label: 'Green',
    color: '#099250',
  },
  {
    label: 'Blue',
    color: '#1570EF',
  },
  {
    label: 'Indigo',
    color: '#444CE7',
  },
  {
    label: 'Purple',
    color: '#6938EF',
  },
  {
    label: 'Fuchsia',
    color: '#BA24D5',
  },
  {
    label: 'Pink',
    color: '#DD2590',
  },
  {
    label: 'Orange',
    color: '#E04F16',
  },
  {
    label: 'Default',
    color: DEFAULT_HEADER_BG_COLOR,
  },
];
