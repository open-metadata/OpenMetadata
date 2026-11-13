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

export const ContextMemory: FC<Props> = ({
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
      d="M13.802 12.136v.354c0 1.074 0 1.611-.214 2.022-.189.36-.49.654-.86.838-.42.209-.972.209-2.073.209H6.382c-.409 0-.613 0-.81.039a2 2 0 0 0-.499.17c-.177.09-.337.214-.657.463l-1.564 1.22c-.273.213-.409.32-.524.32a.33.33 0 0 1-.256-.12C2 17.563 2 17.393 2 17.052V9.038c0-1.075 0-1.612.214-2.022.189-.36.49-.654.86-.838.42-.21 2.004-.21 3.106-.21"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m18 5.487-.79.924-.474.465m-.026 0q.026-.229.026-.465c0-2.31-1.912-4.184-4.27-4.184-2.359 0-4.27 1.873-4.27 4.184s1.911 4.185 4.27 4.185a4.3 4.3 0 0 0 3.321-1.554m-3.321-3.994v1.828l1.145.732"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
ContextMemory.displayName = 'ContextMemory';
