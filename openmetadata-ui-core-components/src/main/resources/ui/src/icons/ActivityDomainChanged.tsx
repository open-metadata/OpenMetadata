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

export const ActivityDomainChanged: FC<Props> = ({
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
      <path d="M10.05 6.552a4.449 4.449 0 1 1-4.449-4.448" />
      <path d="M7.38 6.552c0 2.457-.797 4.449-1.78 4.449S3.82 9.009 3.82 6.552s.797-4.448 1.78-4.448M1.152 6.55h8.898M9.015 1.785a1.308 1.308 0 1 1 0 2.617m1.137-1.958.695-.397m-.695 1.696.695.397M9.015 1.785a1.308 1.308 0 1 0 0 2.617m0 0v.785M7.88 2.444l-.695-.397m.695 1.696-.695.397m1.831-2.355V1" />
    </g>
  </svg>
);
ActivityDomainChanged.displayName = 'ActivityDomainChanged';
