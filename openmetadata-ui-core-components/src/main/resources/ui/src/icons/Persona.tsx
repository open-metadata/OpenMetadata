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

export const Persona: FC<Props> = ({
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
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="M14.73 15.712c-.928-1.4-2.562-2.36-4.453-2.475l-.746-.046q-.399.01-.75.026c-1.875.085-3.516 1.078-4.449 2.495m7.593-7.32a2.4 2.4 0 1 1-4.8 0 2.4 2.4 0 0 1 4.8 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M17.527 9.992a8 8 0 1 1-16 0 8 8 0 0 1 16 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Persona.displayName = 'Persona';
