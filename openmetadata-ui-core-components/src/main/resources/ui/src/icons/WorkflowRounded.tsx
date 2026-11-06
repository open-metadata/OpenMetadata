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

export const WorkflowRounded: FC<Props> = ({
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
      d="M18 16.223c0-.413 0-.62-.045-.79a1.33 1.33 0 0 0-.943-.942c-.17-.046-.376-.046-.79-.046h-2.666c-.414 0-.62 0-.79.046-.46.123-.82.482-.943.943-.045.17-.045.376-.045.79 0 .412 0 .62.045.789.123.46.483.82.943.942.17.046.376.046.79.046h2.666c.414 0 .62 0 .79-.046.46-.123.82-.482.943-.942.045-.17.045-.377.045-.79ZM8.223 3.778c0-.414 0-.62-.046-.79a1.33 1.33 0 0 0-.943-.943C7.064 2 6.858 2 6.444 2H3.779c-.413 0-.62 0-.79.045-.46.124-.819.483-.942.943C2 3.158 2 3.364 2 3.778c0 .413 0 .62.046.79.123.46.483.819.943.942.17.046.376.046.79.046h2.666c.413 0 .62 0 .79-.046.46-.123.819-.483.942-.943.046-.17.046-.376.046-.79Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M12.667 10h.445a3.111 3.111 0 0 0 0-6.223h-4.89m3.555 12.445H6.888a3.111 3.111 0 0 1 0-6.222h.445"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M11.216 8.637c-.573-.573-.86-.86-1.215-.86s-.643.287-1.216.86l-.147.147c-.573.573-.86.86-.86 1.216s.287.642.86 1.215l.147.148c.573.572.86.859 1.215.859s.643-.287 1.216-.86l.147-.147c.573-.573.86-.86.86-1.215s-.287-.643-.86-1.216z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
WorkflowRounded.displayName = 'WorkflowRounded';
