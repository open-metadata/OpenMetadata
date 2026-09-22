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

export const FilterFunnel01: FC<Props> = ({
  size = 24,
  color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    stroke={color}
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    viewBox="0 0 24 24"
    width={size}
    {...props}>
    <path d="M2 4.6c0-.56 0-.84.109-1.054a1 1 0 0 1 .437-.437C2.76 3 3.04 3 3.6 3h16.8c.56 0 .84 0 1.054.109a1 1 0 0 1 .437.437C22 3.76 22 4.04 22 4.6v.67c0 .268 0 .403-.033.528q-.044.166-.141.31c-.073.106-.175.194-.378.37l-6.396 5.543c-.203.176-.305.265-.377.371q-.098.144-.142.31c-.033.125-.033.26-.033.529v5.227c0 .196 0 .294-.031.378a.5.5 0 0 1-.133.196c-.066.06-.157.096-.339.17l-3.4 1.36c-.367.146-.551.22-.699.189a.5.5 0 0 1-.315-.213c-.083-.126-.083-.324-.083-.72v-6.587c0-.27 0-.404-.033-.529a1 1 0 0 0-.141-.31c-.073-.106-.175-.194-.378-.37L2.552 6.478c-.203-.177-.305-.265-.378-.371a1 1 0 0 1-.141-.31C2 5.673 2 5.538 2 5.269z" />
  </svg>
);
FilterFunnel01.displayName = 'FilterFunnel01';
