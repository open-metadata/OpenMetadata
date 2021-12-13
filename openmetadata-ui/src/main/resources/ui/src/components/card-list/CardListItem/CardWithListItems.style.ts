/*
 *  Copyright 2021 Collate
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

export const cardStyle = {
  base: 'tw-flex tw-flex-col tw-rounded-md tw-border tw-mb-4',
  default: 'tw-border-primary-lite',
  active: 'tw-border-primary',
  header: {
    base: 'tw-flex tw-px-5 tw-py-3 tw-cursor-pointer tw-justify-between tw-items-center',
    default: 'tw-bg-tag',
    active: 'tw-bg-primary tw-rounded-t-md tw-text-white',
    title: 'tw-text-base tw-mb-0',
    description: 'tw-font-medium tw-pr-2',
  },
  body: {
    base: 'tw-py-5 tw-px-10',
    default: 'tw-hidden',
    active: 'tw-block',
    content: {
      withBorder: 'tw-py-3 tw-border-b tw-border-main',
      withoutBorder: 'tw-py-1',
    },
  },
};
