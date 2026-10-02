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

export const Server04: FC<Props> = ({
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
    viewBox="0 0 24 24"
    width={size}
    {...props}>
    <path
      d="m22 10.5-.474-3.795c-.186-1.489-.28-2.233-.63-2.794a3 3 0 0 0-1.283-1.133c-.6-.278-1.35-.278-2.85-.278H7.237c-1.5 0-2.25 0-2.85.278a3 3 0 0 0-1.283 1.133c-.35.56-.444 1.305-.63 2.794L2 10.5m3.5 4h13m-13 0a3.5 3.5 0 1 1 0-7h13a3.5 3.5 0 1 1 0 7m-13 0a3.5 3.5 0 1 0 0 7h13a3.5 3.5 0 1 0 0-7M6 11h.01M6 18h.01M12 11h6m-6 7h6"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Server04.displayName = 'Server04';
