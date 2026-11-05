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

export const Dar: FC<Props> = ({
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
      d="M15.716 4.727c0 1.505-2.846 2.724-6.358 2.724S3 6.231 3 4.727m6.358 7.4q-.669 0-1.299-.057C5.171 11.813 3 10.716 3 9.402"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M15.716 8.651v-3.71C15.716 3.317 12.87 2 9.358 2S3 3.317 3 4.941V14.5c0 1.409 2.141 2.586 5 2.874"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M17 13.333a2.333 2.333 0 0 1-2.647 2.313 1.5 1.5 0 0 0-.307-.027.3.3 0 0 0-.134.046c-.048.026-.094.073-.187.165l-1.987 1.988a1 1 0 0 1-.14.125.4.4 0 0 1-.113.046c-.044.011-.092.011-.187.011h-.676c-.218 0-.326 0-.41-.042a.4.4 0 0 1-.17-.17c-.042-.084-.042-.192-.042-.41v-.676c0-.095 0-.143.01-.187a.4.4 0 0 1 .047-.113 1 1 0 0 1 .125-.14l1.988-1.987c.092-.093.139-.14.165-.187a.3.3 0 0 0 .046-.134 1.5 1.5 0 0 0-.027-.307A2.333 2.333 0 1 1 17 13.333m-2.334-.001h.004"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Dar.displayName = 'Dar';
