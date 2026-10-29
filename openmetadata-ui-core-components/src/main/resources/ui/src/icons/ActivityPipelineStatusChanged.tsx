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

export const ActivityPipelineStatusChanged: FC<Props> = ({
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
      d="M8.156 3.296C9.054 2.426 9.502 1.99 10.052 2s.983.458 1.853 1.355c.87.898 1.304 1.347 1.296 1.896s-.458.983-1.356 1.853C10.949 7.974 10.5 8.41 9.95 8.4s-.984-.458-1.853-1.355c-.87-.898-1.305-1.347-1.296-1.896s.457-.984 1.355-1.853ZM6 11.2a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm12 0a2 2 0 1 0-4 0 2 2 0 0 0 4 0Zm-8-2.8V14M8.002 7.201l-2.4 2.4m6.394-2.4 2.4 2.4M8 15.92c0-.905 0-1.358.281-1.639S9.015 14 9.92 14h.16c.905 0 1.358 0 1.639.281s.281.734.281 1.639v.16c0 .905 0 1.358-.281 1.639S10.985 18 10.08 18h-.16c-.905 0-1.358 0-1.639-.281S8 16.985 8 16.08z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
ActivityPipelineStatusChanged.displayName = 'ActivityPipelineStatusChanged';
