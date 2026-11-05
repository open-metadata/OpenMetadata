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

export const Pipeline: FC<Props> = ({
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
      d="M2 16.223c0-.413 0-.62.045-.79.124-.46.483-.819.943-.942.17-.046.376-.046.79-.046h2.666c.414 0 .62 0 .79.046.46.123.82.482.942.943.046.169.046.376.046.789s0 .62-.046.79a1.33 1.33 0 0 1-.942.942c-.17.046-.376.046-.79.046H3.778c-.414 0-.62 0-.79-.046a1.33 1.33 0 0 1-.943-.942C2 16.842 2 16.636 2 16.223m9.777-12.445c0-.414 0-.62.046-.79.123-.46.482-.82.943-.943.17-.045.376-.045.789-.045h2.666c.414 0 .62 0 .79.045.46.124.82.483.943.943.045.17.045.376.045.79 0 .413 0 .62-.045.79-.123.46-.483.819-.943.942-.17.045-.376.045-.79.045h-2.666c-.413 0-.62 0-.79-.045a1.33 1.33 0 0 1-.942-.943c-.046-.17-.046-.376-.046-.79"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M7.333 10h-.445a3.11 3.11 0 0 1 0-6.223h4.889M8.223 16.222h4.888a3.11 3.11 0 0 0 0-6.222h-.444M8.784 8.637c.573-.573.86-.86 1.215-.86s.643.287 1.216.86l.147.147c.573.573.86.86.86 1.216s-.287.642-.86 1.215l-.147.147c-.573.573-.86.86-1.216.86-.355 0-.642-.287-1.215-.86l-.147-.147c-.573-.573-.86-.86-.86-1.215s.287-.643.86-1.216z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Pipeline.displayName = 'Pipeline';
