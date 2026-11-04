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

export const Services: FC<Props> = ({
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
    viewBox="0 0 20 21"
    width={size}
    {...props}>
    <path
      d="M5.083 9.991a3.461 3.461 0 1 0 3.211-5.53m-.919 6.861-.262 1.96M8.294 4.46a3.45 3.45 0 0 0-2.554.675m2.554-.675.263-1.96M5.083 9.991a3.45 3.45 0 0 1-.679-2.56v-.004m.68 2.564-1.57 1.199m1.57-1.199.002-.002m-.681-2.562A3.45 3.45 0 0 1 5.74 5.135M4.405 7.427l-1.956-.262m1.956.262h.005m1.33-2.292L4.542 3.566m1.198 1.57.003.002m4.845.649 1.572-1.2m-.889 3.76 1.96.262M9.946 10.64l1.2 1.572m1.274 3.977a2.158 2.158 0 1 0 3.987-1.655m-3.987 1.655a2.15 2.15 0 0 1 0-1.653m0 1.653-1.139.472m5.126-2.127a2.15 2.15 0 0 0-1.164-1.166m1.164 1.166 1.14-.473m-5.128.475c.212-.51.617-.94 1.167-1.168l.003-.001m-1.17 1.169-1.137-.47m1.137.47h.002m1.168-1.17a2.15 2.15 0 0 1 1.654.002m-1.654-.001-.471-1.137m.471 1.137.001.002m1.653 0 .47-1.138m-.47 1.137v.003m1.168 2.815 1.14.47m-2.306.7.473 1.14m-2.125-1.136-.471 1.14"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Services.displayName = 'Services';
