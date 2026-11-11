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

export const GovernanceFilled: FC<Props> = ({
  size = 20,
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
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path d="M2.668 17.5h14.5" stroke="currentColor" strokeWidth={1.5} />
    <path
      d="M2 8.272c0-.579.277-1.118.736-1.433l5.521-3.793a3.05 3.05 0 0 1 3.486 0l5.521 3.793c.459.315.736.854.736 1.433 0 .944-.724 1.71-1.616 1.71H3.616C2.724 9.982 2 9.216 2 8.272Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1.5}
    />
    <path
      d="M8.4 10.594v6.77m3.2-6.77v6.77m4-6.77v6.77m-11.2-6.77v6.77"
      stroke="currentColor"
      strokeWidth={1.5}
    />
  </svg>
);
GovernanceFilled.displayName = 'GovernanceFilled';
