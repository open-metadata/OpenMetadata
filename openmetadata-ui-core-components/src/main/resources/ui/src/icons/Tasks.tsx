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

export const Tasks: FC<Props> = ({
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
      d="M16.402 13.2V6.8c0-2.263 0-3.394-.703-4.097S13.864 2 11.602 2h-3.2c-2.263 0-3.395 0-4.097.703S3.602 4.537 3.602 6.8v6.4c0 2.263 0 3.394.703 4.097C5.007 18 6.139 18 8.402 18h3.2c2.262 0 3.394 0 4.097-.703s.703-1.834.703-4.097"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M12.803 2h-5.6c0 1.131 0 1.697.352 2.049.351.351.917.351 2.048.351h.8c1.131 0 1.697 0 2.049-.351.351-.352.351-.918.351-2.049M6.398 9.2l.8.8 1.6-2m2.402 6h2.4m-2.4-4.8h2.4M7.3 14h-.1m.2 0a.2.2 0 1 1-.4 0 .2.2 0 0 1 .4 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Tasks.displayName = 'Tasks';
