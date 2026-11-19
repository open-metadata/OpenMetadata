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

export const Book: FC<Props> = ({
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
      d="M16.4 18H5.2a1.6 1.6 0 0 1-1.6-1.6m0 0a1.6 1.6 0 0 1 1.6-1.6h9.6a1.6 1.6 0 0 0 1.6-1.6V2a1.6 1.6 0 0 1-1.6 1.6H8.4c-2.263 0-3.395 0-4.097.703S3.6 6.137 3.6 8.4z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M15.2 14.8s-.8.611-.8 1.6.8 1.6.8 1.6M7.6 3.602v3.2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Book.displayName = 'Book';
