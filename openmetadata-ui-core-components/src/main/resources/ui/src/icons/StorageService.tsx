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

export const StorageService: FC<Props> = ({
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
      d="M5.6 13.934a3.6 3.6 0 0 1-.703-7.131c.146-.029.22-.043.264-.07a.26.26 0 0 0 .097-.093c.029-.043.046-.113.08-.253a4.802 4.802 0 0 1 9.324 0c.034.14.051.21.08.253a.26.26 0 0 0 .097.093c.045.027.118.041.264.07a3.601 3.601 0 0 1-.703 7.131"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M12.667 11.602c0 .552-1.194 1-2.666 1-1.473 0-2.667-.448-2.667-1 0-.553 1.194-1 2.667-1s2.666.447 2.666 1"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M7.334 11.602v4.666c0 .553 1.193 1 2.667 1s2.666-.447 2.666-1v-4.666"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M7.334 13.934c0 .553 1.193 1 2.667 1s2.666-.447 2.666-1"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
StorageService.displayName = 'StorageService';
