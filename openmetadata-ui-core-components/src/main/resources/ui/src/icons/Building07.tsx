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

export const Building07: FC<Props> = ({
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
      d="M6.25 9.167H3.833c-.467 0-.7 0-.878.091a.83.83 0 0 0-.364.364c-.091.178-.091.411-.091.878v7m11.25-8.333h2.417c.467 0 .7 0 .878.091a.83.83 0 0 1 .364.364c.091.178.091.411.091.878v7m-3.75 0V5.167c0-.933 0-1.4-.182-1.757a1.67 1.67 0 0 0-.728-.728c-.357-.182-.823-.182-1.757-.182H8.916c-.933 0-1.4 0-1.757.182a1.67 1.67 0 0 0-.728.728c-.181.357-.181.823-.181 1.757V17.5m12.083 0H1.667m7.5-11.667h1.667M9.167 9.166h1.667m-1.667 3.333h1.667"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Building07.displayName = 'Building07';
