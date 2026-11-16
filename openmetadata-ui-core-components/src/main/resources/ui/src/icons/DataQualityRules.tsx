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

export const DataQualityRules: FC<Props> = ({
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
      d="M8.182 16.334H3.593c-.88 0-1.593-.753-1.593-1.68V4.57c0-.928.713-1.68 1.593-1.68h11.153c.88 0 1.593.752 1.593 1.68v2.16"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M4.51 6.927 5.764 8.18l2.51-2.51M4.51 12.305l1.254 1.254 2.51-2.509m2.688-4.122h2.868m3.578 3.076h-5.923a.59.59 0 0 0-.592.592v1.585a5.2 5.2 0 0 0 3.553 4.93A5.2 5.2 0 0 0 18 12.181v-1.585a.59.59 0 0 0-.593-.592"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m13.31 12.95.845.804 1.969-1.875"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
DataQualityRules.displayName = 'DataQualityRules';
