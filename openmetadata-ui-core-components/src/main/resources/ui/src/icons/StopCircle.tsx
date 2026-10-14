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

export const StopCircle: FC<Props> = ({
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
      d="M10 18.333c4.603 0 8.333-3.731 8.333-8.333S14.603 1.667 10 1.667 1.667 5.398 1.667 10 5.398 18.333 10 18.333"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M6.667 8c0-.467 0-.7.091-.878a.83.83 0 0 1 .364-.364c.178-.091.411-.091.878-.091h4c.467 0 .7 0 .878.091a.83.83 0 0 1 .364.364c.091.178.091.411.091.878v4c0 .467 0 .7-.091.878a.83.83 0 0 1-.364.364c-.178.091-.411.091-.878.091H8c-.467 0-.7 0-.878-.091a.83.83 0 0 1-.364-.364c-.091-.178-.091-.411-.091-.878z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
StopCircle.displayName = 'StopCircle';
