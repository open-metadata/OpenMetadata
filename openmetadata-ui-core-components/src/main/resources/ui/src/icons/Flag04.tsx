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

export const Flag04: FC<Props> = ({
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
    <path
      d="M11.25 5.417h5.172c.357 0 .536 0 .643.075a.42.42 0 0 1 .173.281c.019.13-.061.289-.221.608l-1.043 2.088a1 1 0 0 0-.088.21.4.4 0 0 0-.003.146c.008.055.032.108.078.213l1.123 2.525c.139.313.208.468.186.595a.42.42 0 0 1-.176.271c-.107.072-.277.072-.619.072h-6.392c-.467 0-.7 0-.878-.091a.83.83 0 0 1-.364-.364c-.091-.178-.091-.412-.091-.878V9.167M2.5 17.5V2.917m0 6.25h7.417c.467 0 .7 0 .878-.091a.83.83 0 0 0 .364-.364c.091-.178.091-.412.091-.878V3.417c0-.467 0-.7-.091-.878a.83.83 0 0 0-.364-.364c-.178-.092-.412-.092-.878-.092H3.833c-.467 0-.7 0-.878.091a.83.83 0 0 0-.364.364c-.091.179-.091.412-.091.879z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Flag04.displayName = 'Flag04';
