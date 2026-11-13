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

export const McpService: FC<Props> = ({
  size = 20,
  color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    color={color}
    fill="none"
    height={size}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="M16.363 2.61a1.636 1.636 0 1 0 0 3.272 1.636 1.636 0 0 0 0-3.273M3.636 2.61a1.636 1.636 0 1 0 0 3.272 1.636 1.636 0 0 0 0-3.273m11.545 2.723-1.685 1.42m-8.68-1.416 1.606 1.288m9.941 10.766a1.636 1.636 0 1 1 0-3.273 1.636 1.636 0 0 1 0 3.273m-12.727 0a1.636 1.636 0 1 1 0-3.273 1.636 1.636 0 0 1 0 3.273m11.545-2.724-1.685-1.42m-8.68 1.417 1.606-1.288M7.638 6.34h4.509a1.4 1.4 0 0 1 1.4 1.4v4.508a1.4 1.4 0 0 1-1.4 1.4H7.638a1.4 1.4 0 0 1-1.4-1.4V7.74a1.4 1.4 0 0 1 1.4-1.4"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m8.86 10.179.51.581 1.752-1.295"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
McpService.displayName = 'McpService';
