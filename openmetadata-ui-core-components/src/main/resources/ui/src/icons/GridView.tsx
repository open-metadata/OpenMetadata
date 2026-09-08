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

export const GridView: FC<Props> = ({
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
      d="M2.79 7.923c.449.3 1.073.3 2.321.3s1.873 0 2.322-.3c.194-.13.36-.296.49-.49.3-.449.3-1.073.3-2.322 0-1.248 0-1.872-.3-2.32a1.8 1.8 0 0 0-.49-.491C6.984 2 6.36 2 5.11 2c-1.248 0-1.872 0-2.32.3-.195.13-.362.296-.491.49C2 3.24 2 3.863 2 5.111s0 1.873.3 2.322c.13.194.296.36.49.49m9.778 0c.448.3 1.072.3 2.32.3 1.25 0 1.874 0 2.322-.3.194-.13.36-.296.49-.49.3-.449.3-1.073.3-2.322 0-1.248 0-1.872-.3-2.32a1.8 1.8 0 0 0-.49-.491c-.448-.3-1.073-.3-2.321-.3s-1.873 0-2.321.3a1.8 1.8 0 0 0-.491.49c-.3.449-.3 1.073-.3 2.321s0 1.873.3 2.322c.13.194.296.36.49.49M2.79 17.7c.449.3 1.073.3 2.321.3s1.873 0 2.322-.3c.194-.13.36-.296.49-.49.3-.448.3-1.073.3-2.321s0-1.873-.3-2.321a1.8 1.8 0 0 0-.49-.491c-.449-.3-1.073-.3-2.322-.3-1.248 0-1.872 0-2.32.3-.195.13-.362.296-.491.49-.3.449-.3 1.073-.3 2.322 0 1.248 0 1.873.3 2.321.13.194.296.36.49.49m9.778 0c.448.3 1.072.3 2.32.3 1.25 0 1.874 0 2.322-.3.194-.13.36-.296.49-.49.3-.448.3-1.073.3-2.321s0-1.873-.3-2.321a1.8 1.8 0 0 0-.49-.491c-.448-.3-1.073-.3-2.321-.3s-1.873 0-2.321.3q-.294.197-.491.49c-.3.449-.3 1.073-.3 2.322 0 1.248 0 1.873.3 2.321q.197.293.49.49"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
GridView.displayName = 'GridView';
