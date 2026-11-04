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

export const Directory: FC<Props> = ({
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
      d="M2 16c0-.943 0-1.414.351-1.707C2.703 14 3.27 14 4.4 14s1.697 0 2.049.293.351.764.351 1.707 0 1.414-.351 1.707C6.097 18 5.53 18 4.4 18s-1.697 0-2.049-.293S2 16.943 2 16m11.201 0c0-.943 0-1.414.352-1.707C13.904 14 14.47 14 15.6 14s1.697 0 2.049.293S18 15.057 18 16s0 1.414-.351 1.707S16.733 18 15.6 18s-1.697 0-2.048-.293c-.352-.293-.352-.764-.352-1.707m2.4-2.003c0-2.648-.595-3.2-3.446-3.2H7.847c-2.852 0-3.447.552-3.447 3.2M10 8.4h.45c1.264 0 1.896 0 2.35-.3.197-.13.366-.296.497-.49.303-.449.303-1.073.303-2.321 0-.75 0-1.124-.182-1.393a1.1 1.1 0 0 0-.298-.294c-.272-.18-.651-.18-1.41-.18h-1.196c-.103 0-.155 0-.203-.007a.66.66 0 0 1-.442-.268 1.4 1.4 0 0 1-.097-.175c-.189-.373-.361-.749-.78-.904C8.81 2 8.6 2 8.18 2c-.654 0-.98 0-1.226.135a1.1 1.1 0 0 0-.417.412c-.137.242-.137.565-.137 1.211v1.086c0 1.677 0 2.515.528 3.035C7.455 8.4 8.303 8.4 10 8.4"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Directory.displayName = 'Directory';
