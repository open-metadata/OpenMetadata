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

import React from 'react';
import { VersionIndicatorInterface } from './VersionIndicatorIcon.interface';

export const VersionIndicatorIcon = ({
  fill,
  style,
}: VersionIndicatorInterface) => {
  return (
    <svg
      fill="none"
      height="1em"
      style={style}
      viewBox="0 0 13 6"
      width="1em"
      xmlns="http://www.w3.org/2000/svg">
      <path
        clipRule="evenodd"
        d="M7.878 3.002a1.876 1.876 0 11-3.751 0 1.876 1.876 0 013.751 0zm1.073.562a3.003 3.003 0 01-5.897 0H.563a.563.563 0 010-1.125h2.49a3.002 3.002 0 015.898 0h2.491a.563.563 0 010 1.125H8.951z"
        fill={fill}
        fillRule="evenodd"
      />
    </svg>
  );
};
