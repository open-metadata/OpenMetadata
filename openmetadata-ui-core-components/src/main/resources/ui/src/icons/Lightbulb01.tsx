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

export const Lightbulb01: FC<Props> = ({
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
      d="M6.63 13.788a5.1 5.1 0 0 1-1.685-3.79 5.053 5.053 0 1 1 10.106 0 5.1 5.1 0 0 1-1.685 3.79M10 10v3.79m-2.11 2.105h4.211M8.734 18h2.527m-8.419-8H2m2.934-5.072-.631-.629m10.766.629.632-.629M18 10h-.842M10 2v.842"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Lightbulb01.displayName = 'Lightbulb01';
