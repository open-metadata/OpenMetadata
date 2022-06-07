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
      className="tw-inline-block tw-h-2.5 tw-w-2.5 tw-ml-1.5"
      fill="currentColor"
      style={style}
      viewBox="0 0 11 6"
      xmlns="http://www.w3.org/2000/svg">
      <path
        d="M0.740147 0H10.2599C10.9184 0 11.2477 0.764898 10.7815 1.21316L6.02353 5.79188C5.73494 6.06937 5.26506 6.06937 4.97647 5.79188L0.218469 1.21316C-0.247712 0.764898 0.0815744 0 0.740147 0Z"
        fill="#485056"
      />
    </svg>
  );
};
