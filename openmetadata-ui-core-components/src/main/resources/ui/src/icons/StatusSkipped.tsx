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

export const StatusSkipped: FC<Props> = ({
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
      d="M17.932 8.955a8 8 0 0 1 0 2.09m-.539-4.107a8 8 0 0 0-1.046-1.808M14.87 3.653a8 8 0 0 0-1.808-1.046m-2.017-.54a8 8 0 0 0-2.09 0m-2.017.54c-.65.27-1.258.623-1.808 1.046M3.653 5.13a8 8 0 0 0-1.046 1.808m-.54 2.017a8 8 0 0 0 0 2.09m.54 2.017c.27.65.623 1.258 1.046 1.808m1.477 1.477a8 8 0 0 0 1.808 1.046m2.017.54a8 8 0 0 0 2.09 0m2.017-.54a8 8 0 0 0 1.808-1.046m1.477-1.477a8 8 0 0 0 1.046-1.808"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
StatusSkipped.displayName = 'StatusSkipped';
