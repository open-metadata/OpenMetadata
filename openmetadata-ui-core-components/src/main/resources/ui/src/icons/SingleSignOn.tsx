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

export const SingleSignOn: FC<Props> = ({
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
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="M11.2 6H8.8c-1.509 0-2.263 0-2.732.469C5.6 6.937 5.6 7.692 5.6 9.2v.4c0 1.509 0 2.263.468 2.732s1.223.469 2.732.469h2.4c1.509 0 2.263 0 2.732-.469.468-.469.468-1.223.468-2.732v-.4c0-1.508 0-2.263-.468-2.731C13.463 6 12.709 6 11.2 6M7.6 6V4.4a2.4 2.4 0 1 1 4.8 0V6m-1.2 9.602-2.401 2.4m0-2.4 2.4 2.4m6.002-2.4-2.4 2.4m0-2.4 2.4 2.4M5.2 15.602l-2.401 2.4m0-2.4 2.4 2.4"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
SingleSignOn.displayName = 'SingleSignOn';
