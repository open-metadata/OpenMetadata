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

export const ChevronCollapseVertical: FC<Props> = ({
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
      d="M10 12.2a.27.27 0 0 0-.193.08L7.08 15.03a.276.276 0 0 0 0 .388.27.27 0 0 0 .386 0L10 12.863l2.534 2.555a.27.27 0 0 0 .386 0 .276.276 0 0 0 0-.389l-2.727-2.75A.27.27 0 0 0 10 12.2Zm0-4.4a.27.27 0 0 1-.193-.08L7.08 4.97a.276.276 0 0 1 0-.39.27.27 0 0 1 .386 0L10 7.137l2.534-2.555a.27.27 0 0 1 .386 0 .276.276 0 0 1 0 .388l-2.727 2.75A.27.27 0 0 1 10 7.8Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
ChevronCollapseVertical.displayName = 'ChevronCollapseVertical';
