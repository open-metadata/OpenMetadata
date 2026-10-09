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

export const ActivityColumnDescriptionUpdated: FC<Props> = ({
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
    viewBox="0 0 12 12"
    width={size}
    {...props}>
    <path
      d="M5.822 10.823c-2.273 0-3.41 0-4.116-.707C1 9.41 1 8.273 1 6s0-3.41.706-4.116 1.843-.706 4.116-.706c2.274 0 3.41 0 4.117.706.637.638.7 1.627.705 3.487M1 4.477h9.645M3.793 7.523h2.124m-2.124 2.876V4.477m4.669 6.026-.837.167.167-.837a.9.9 0 0 1 .24-.449l1.961-1.96a.44.44 0 0 1 .621 0l.258.257a.44.44 0 0 1 0 .621l-1.96 1.96a.9.9 0 0 1-.45.24"
      stroke="currentColor"
    />
  </svg>
);
ActivityColumnDescriptionUpdated.displayName =
  'ActivityColumnDescriptionUpdated';
