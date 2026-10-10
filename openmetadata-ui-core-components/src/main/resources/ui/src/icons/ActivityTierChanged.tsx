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

export const ActivityTierChanged: FC<Props> = ({
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
    viewBox="0 0 12 12"
    width={size}
    {...props}>
    <g stroke="currentColor">
      <path d="m4.321 1.573-.852.394c-1.313.607-1.969.91-1.969 1.408s.656.801 1.97 1.408l.851.394c.827.382 1.24.573 1.679.573s.852-.19 1.678-.573l.853-.394c1.313-.607 1.969-.91 1.969-1.408s-.656-.801-1.97-1.408l-.851-.394C6.852 1.19 6.438 1 6 1s-.852.19-1.679.573" />
      <path d="M10.394 5.549q.106.148.106.317c0 .49-.656.79-1.97 1.388l-.851.388c-.827.377-1.24.565-1.679.565s-.852-.188-1.679-.565l-.852-.388C2.156 6.656 1.5 6.357 1.5 5.866q0-.17.106-.317" />
      <path d="M10.188 8.133c.208.165.312.33.312.526 0 .49-.656.79-1.97 1.388l-.851.388C6.852 10.812 6.438 11 6 11s-.852-.188-1.679-.565l-.852-.388C2.156 9.449 1.5 9.15 1.5 8.659c0-.196.104-.36.312-.526" />
    </g>
  </svg>
);
ActivityTierChanged.displayName = 'ActivityTierChanged';
