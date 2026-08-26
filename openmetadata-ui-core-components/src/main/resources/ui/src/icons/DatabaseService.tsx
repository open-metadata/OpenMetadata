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

export const DatabaseService: FC<Props> = ({
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
      d="M16.222 2.89H3.778A1.78 1.78 0 0 0 2 4.669v2.667c0 .982.796 1.778 1.778 1.778h12.444c.982 0 1.778-.796 1.778-1.778V4.668c0-.981-.796-1.777-1.778-1.777m0 7.999H3.778c-.982 0-1.778.797-1.778 1.778v2.667c0 .982.796 1.778 1.778 1.778h12.444c.982 0 1.778-.796 1.778-1.778v-2.667c0-.981-.796-1.777-1.778-1.777M5.203 6h.009m-.009 8h.009"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
DatabaseService.displayName = 'DatabaseService';
