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

export const MetadataService: FC<Props> = ({
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
      d="M16.222 2.89H3.778A1.78 1.78 0 0 0 2 4.669v10.667c0 .982.796 1.778 1.778 1.778h12.444c.982 0 1.778-.796 1.778-1.778V4.668c0-.981-.796-1.777-1.778-1.777M2 6.89h16"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M7.332 9.559 5.555 11.78l1.777 2.222m5.334-4.444 1.778 2.222-1.778 2.222"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
MetadataService.displayName = 'MetadataService';
