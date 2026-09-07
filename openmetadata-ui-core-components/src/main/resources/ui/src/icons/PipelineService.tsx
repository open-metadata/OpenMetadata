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

export const PipelineService: FC<Props> = ({
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
      d="M15.778 2.5H4.222C2.995 2.5 2 3.433 2 4.583v10.834c0 1.15.995 2.083 2.222 2.083h11.556c1.227 0 2.222-.933 2.222-2.083V4.583c0-1.15-.995-2.083-2.222-2.083"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M6.5 14.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3m7-6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M8.035 13.001h2.466a3 3 0 0 0 3-3V8.578"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
PipelineService.displayName = 'PipelineService';
