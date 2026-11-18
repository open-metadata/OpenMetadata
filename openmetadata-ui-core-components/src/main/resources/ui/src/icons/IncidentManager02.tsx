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

export const IncidentManager02: FC<Props> = ({
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
      d="M8.689 12.044H5.311m6.4 2.845h-6.4m10.49-2.489v1.76c0 1.344 0 2.016-.262 2.53a2.4 2.4 0 0 1-1.05 1.048C13.977 18 13.305 18 11.96 18H6.84c-1.344 0-2.016 0-2.53-.262a2.4 2.4 0 0 1-1.048-1.048C3 16.176 3 15.504 3 14.16V5.84c0-1.344 0-2.016.262-2.53A2.4 2.4 0 0 1 4.31 2.262C4.824 2 5.496 2 6.84 2h.96"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M17.399 6.444a4.444 4.444 0 1 1-8.89 0 4.444 4.444 0 0 1 8.89 0m-4.444-2.667v2.311m0 2.312h.008"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
IncidentManager02.displayName = 'IncidentManager02';
