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

export const Edit01: FC<Props> = ({
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
      d="M2.397 15.097c.038-.345.058-.517.109-.678a1.7 1.7 0 0 1 .195-.404c.093-.142.216-.264.461-.508L14.167 2.5A2.357 2.357 0 1 1 17.5 5.833L6.495 16.838c-.245.245-.368.368-.509.461a1.7 1.7 0 0 1-.404.194c-.161.053-.333.072-.678.11l-2.821.314z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Edit01.displayName = 'Edit01';
