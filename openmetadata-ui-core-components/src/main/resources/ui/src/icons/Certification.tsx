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

export const Certification: FC<Props> = ({
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
      d="M7.941 2.85c1.006-.567 1.51-.85 2.06-.85s1.053.283 2.059.85l1.4.789c1.044.588 1.566.882 1.853 1.374s.287 1.092.287 2.292v1.39c0 1.2 0 1.8-.287 2.292s-.81.786-1.854 1.374l-1.4.789c-1.005.567-1.508.85-2.059.85-.55 0-1.053-.283-2.059-.85l-1.4-.789c-1.044-.588-1.566-.882-1.853-1.374C4.4 10.495 4.4 9.895 4.4 8.695v-1.39c0-1.2 0-1.8.288-2.292.287-.492.809-.786 1.853-1.374z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M7.6 8.532s.6 0 1.2 1.066c0 0 1.906-2.666 3.6-3.2m1.505 6 .536 2.568c.345 1.65.517 2.475.163 2.866-.353.391-.968.055-2.197-.618l-1.819-.995c-.29-.16-.435-.239-.589-.239s-.299.08-.589.239l-1.819.995c-1.229.673-1.843 1.01-2.197.618-.354-.39-.181-1.216.163-2.866l.536-2.568"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Certification.displayName = 'Certification';
