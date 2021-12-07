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

export const button = {
  base: `tw-align-bottom tw-inline-flex tw-items-center tw-justify-center tw-cursor-pointer 
    tw-leading-5 tw-transition-colors tw-duration-150 tw-font-medium focus:tw-outline-none`,
  block: 'tw-block tw-w-full',
  size: {
    large: 'tw-px-5 tw-py-3 tw-rounded-lg',
    regular: 'tw-px-4 tw-py-2 tw-rounded-lg tw-text-sm',
    small: 'tw-px-2 tw-py-0.5 tw-rounded-md tw-text-sm',
    'x-small': 'tw-px-2 tw-py-px tw-rounded-md tw-text-xs',
    custom: '',
  },
  contained: {
    default: {
      base: 'tw-text-gray-600 tw-bg-gray-300 tw-border tw-border-transparent',
      active:
        'active:tw-bg-gray-400 hover:tw-bg-gray-400 focus:tw-ring focus:tw-ring-gray-300',
      disabled: 'tw-opacity-50 tw-cursor-not-allowed',
    },
    primary: {
      base: 'tw-text-white tw-bg-primary tw-border tw-border-transparent',
      active:
        'active:tw-bg-primary-active hover:tw-bg-primary-hover focus:tw-bg-primary-active focus:tw-ring focus:tw-ring-purple-300',
      disabled: 'tw-opacity-50 tw-cursor-not-allowed',
    },
  },
  outlined: {
    default: {
      base: 'tw-text-grey-muted tw-border-gray-300 tw-border dark:tw-text-gray-400 focus:tw-outline-none',
      active: `active:tw-bg-transparent hover:tw-border-gray-600 focus:tw-border-gray-600 
      hover:tw-text-gray-600 active:tw-text-gray-600 focus:tw-ring focus:tw-ring-gray-300`,
      disabled: 'tw-opacity-50 tw-cursor-not-allowed',
    },
    primary: {
      base: 'tw-text-primary tw-border-primary tw-border dark:tw-text-blue-300 focus:tw-outline-none',
      active: `active:tw-bg-transparent hover:tw-bg-primary hover:tw-text-white focus:tw-bg-primary 
      active:tw-bg-primary active:tw-text-white focus:tw-ring focus:tw-ring-purple-300`,
      disabled: 'tw-opacity-50 tw-cursor-not-allowed',
    },
  },
  link: {
    default: {
      base: 'tw-text-grey-muted dark:tw-text-gray-400 focus:tw-outline-none',
      active: `active:tw-bg-transparent hover:tw-underline focus:tw-underline 
        hover:tw-text-gray-600 active:tw-text-gray-600`,
      disabled: 'tw-opacity-50 tw-cursor-not-allowed',
    },
    primary: {
      base: 'tw-text-primary dark:tw-text-blue-300 focus:tw-outline-none',
      active: `active:tw-bg-transparent hover:tw-underline focus:tw-underline 
        hover:tw-text-primary-hover active:tw-text-primary-active`,
      disabled: 'tw-opacity-50 tw-cursor-not-allowed',
    },
  },
  text: {
    default: {
      base: 'tw-text-grey-muted dark:tw-text-gray-400 focus:tw-outline-none',
      active: `active:tw-bg-transparent hover:tw-text-gray-600 active:tw-text-gray-600`,
      disabled: 'tw-opacity-50 tw-cursor-not-allowed',
    },
    primary: {
      base: 'tw-text-primary dark:tw-text-blue-300 focus:tw-outline-none',
      active: `active:tw-bg-transparent hover:tw-text-primary-hover active:tw-text-primary-active`,
      disabled: 'tw-opacity-50 tw-cursor-not-allowed',
    },
  },
};
