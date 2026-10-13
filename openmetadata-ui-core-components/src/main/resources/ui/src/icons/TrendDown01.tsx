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

export const TrendDown01: FC<Props> = ({
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
      d="m18 14-6.295-6.295c-.317-.317-.475-.475-.658-.534a.8.8 0 0 0-.494 0c-.183.059-.341.217-.658.534l-2.19 2.19c-.317.317-.475.475-.658.535a.8.8 0 0 1-.494 0c-.183-.06-.341-.218-.658-.535L2 6m16 2.4V14h-5.6"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
TrendDown01.displayName = 'TrendDown01';
