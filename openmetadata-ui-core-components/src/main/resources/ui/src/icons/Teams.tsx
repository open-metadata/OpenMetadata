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

export const Teams: FC<Props> = ({
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
      d="M14.847 15.456c0-.846 0-1.268-.104-1.613a2.42 2.42 0 0 0-1.616-1.616c-.344-.104-.767-.104-1.613-.104h-3.03c-.845 0-1.267 0-1.612.104a2.42 2.42 0 0 0-1.615 1.616c-.105.345-.105.767-.105 1.613m7.574-8.182a2.727 2.727 0 1 1-5.454 0 2.727 2.727 0 0 1 5.454 0m3.107 4.939c.55 0 .825 0 1.049.067.503.153.898.548 1.05 1.052.068.223.068.498.068 1.048m-3.152-3.547a1.773 1.773 0 0 0 0-3.548M4.167 12.213c-.55 0-.825 0-1.049.067a1.58 1.58 0 0 0-1.05 1.052C2 13.555 2 13.83 2 14.38m3.152-3.547a1.774 1.774 0 0 1 0-3.548"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Teams.displayName = 'Teams';
