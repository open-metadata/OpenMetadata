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

export const Server01: FC<Props> = ({
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
      d="M5 5h.008M5 15h.008m-.675-6.667h11.333c.933 0 1.4 0 1.757-.182a1.67 1.67 0 0 0 .728-.728c.182-.356.182-.823.182-1.756V4.333c0-.933 0-1.4-.182-1.757a1.67 1.67 0 0 0-.728-.728c-.356-.181-.823-.181-1.756-.181H4.333c-.933 0-1.4 0-1.757.182a1.67 1.67 0 0 0-.728.728c-.181.356-.181.823-.181 1.756v1.333c0 .933 0 1.4.182 1.757a1.67 1.67 0 0 0 .728.728c.356.182.823.182 1.756.182m0 10h11.333c.933 0 1.4 0 1.757-.182a1.67 1.67 0 0 0 .728-.728c.182-.356.182-.823.182-1.756v-1.333c0-.933 0-1.4-.182-1.757a1.67 1.67 0 0 0-.728-.728c-.356-.182-.823-.182-1.756-.182H4.333c-.933 0-1.4 0-1.757.182a1.67 1.67 0 0 0-.728.728c-.181.356-.181.823-.181 1.756v1.333c0 .933 0 1.4.182 1.757a1.67 1.67 0 0 0 .728.728c.356.182.823.182 1.756.182"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Server01.displayName = 'Server01';
