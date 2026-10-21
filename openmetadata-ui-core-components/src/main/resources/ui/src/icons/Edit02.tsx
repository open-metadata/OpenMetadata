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

export const Edit02: FC<Props> = ({
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
      d="M15 8.333 11.667 5M2.083 17.917l2.82-.313c.345-.038.517-.058.678-.109a1.7 1.7 0 0 0 .404-.195c.142-.092.264-.216.508-.461L17.5 5.833A2.357 2.357 0 1 0 14.167 2.5L3.162 13.505c-.245.245-.368.368-.461.509a1.7 1.7 0 0 0-.195.404c-.052.161-.071.333-.109.678z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Edit02.displayName = 'Edit02';
