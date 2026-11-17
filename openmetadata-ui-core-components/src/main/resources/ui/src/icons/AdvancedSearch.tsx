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
import * as React from 'react';
import type { SVGProps, FC } from 'react';
interface Props extends SVGProps<SVGSVGElement> {
  color?: string;
  size?: number;
}

export const AdvancedSearch: FC<Props> = ({
  size = 20,
  color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    color={color}
    fill="none"
    height={size}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="M14.333 13.443 18 17.11m-3.667-3.667a6.16 6.16 0 0 1-4.372 1.812 6.16 6.16 0 0 1-2.936-.74m7.308-1.072a6.184 6.184 0 1 0-9.095-8.365m.393 2.692h-2.74m5.737 3.878H5.816m4.228-3.878h-.716M2 11.648h.129"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M7.005 6.648c.26 0 .391 0 .494.043a.56.56 0 0 1 .304.303c.042.103.042.234.042.495v.56c0 .261 0 .392-.042.495a.56.56 0 0 1-.304.303c-.103.043-.233.043-.494.043s-.392 0-.495-.043a.56.56 0 0 1-.303-.303c-.043-.103-.043-.234-.043-.495v-.56c0-.261 0-.392.043-.495a.56.56 0 0 1 .303-.303c.103-.043.234-.043.495-.043M4.514 10.43c.284 0 .426 0 .538.046a.6.6 0 0 1 .33.33c.046.112.046.254.046.538v.609c0 .284 0 .426-.047.538a.6.6 0 0 1-.33.33c-.111.046-.253.046-.537.046s-.426 0-.538-.046a.6.6 0 0 1-.33-.33c-.046-.112-.046-.254-.046-.538v-.61c0-.283 0-.425.046-.537a.6.6 0 0 1 .33-.33c.112-.046.254-.046.538-.046"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
AdvancedSearch.displayName = 'AdvancedSearch';
