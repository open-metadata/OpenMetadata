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

export const InheritedRoles: FC<Props> = ({
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
      d="M6.697 1.86h6.448c.65 0 1.178.527 1.178 1.177V6.68c0 .65-.528 1.178-1.178 1.178H6.697c-.65 0-1.177-.527-1.177-1.178V3.037c0-.65.527-1.178 1.177-1.178ZM2.568 14.813h3.107c.314 0 .568.292.568.653v2.024c0 .361-.254.654-.568.654H2.568c-.314 0-.568-.293-.568-.654v-2.024c0-.36.254-.653.568-.653Zm5.798 0h3.108c.314 0 .568.292.568.653v2.024c0 .361-.254.654-.568.654H8.366c-.313 0-.567-.293-.567-.654v-2.024c0-.36.254-.653.567-.653Zm5.959 0h3.108c.314 0 .568.292.568.653v2.024c0 .361-.254.654-.568.654h-3.108c-.313 0-.567-.293-.567-.654v-2.024c0-.36.254-.653.567-.653ZM9.92 14.32V8.012M3.963 14.32v-2.804h11.915v2.803"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
InheritedRoles.displayName = 'InheritedRoles';
