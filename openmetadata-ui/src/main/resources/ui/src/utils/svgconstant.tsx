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

import React, { CSSProperties } from 'react';

export const dropdownIcon = ({ style }: { style?: CSSProperties }) => {
  return (
    <svg
      aria-hidden="true"
      className="tw-inline-block tw-h-4 tw-w-4 tw-ml-0.5"
      fill="currentColor"
      style={style}
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8.00003 11C7.87216 11 7.74416 10.9511 7.64653 10.8535L2.64653 5.8535C2.45116 5.65813 
        2.45116 5.34175 2.64653 5.1465C2.84191 4.95125 3.15828 4.95113 3.35353 5.1465L8.00003 
        9.793L12.6465 5.1465C12.8419 4.95113 13.1583 4.95113 13.3535 5.1465C13.5488 5.34188 
        13.5489 5.65825 13.3535 5.8535L8.35354 10.8535C8.25591 10.9511 8.12791 11 8.00003 11Z"
        strokeWidth="0.2"
      />
    </svg>
  );
};
