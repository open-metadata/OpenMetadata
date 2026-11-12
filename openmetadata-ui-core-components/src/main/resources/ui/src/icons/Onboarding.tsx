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

export const Onboarding: FC<Props> = ({
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
      d="M6.145 9.782c.827-.86 1.955-1.423 3.2-1.484q.306-.015.656-.025l.653.044a4.93 4.93 0 0 1 3.121 1.393m-1.149-5.085a2.625 2.625 0 1 1-5.251 0 2.625 2.625 0 0 1 5.25 0Zm-5.251 5.25h-.918c-1.423 0-2.135 0-2.577.322s-.442.84-.442 1.876v2.533c0 1.037 0 1.555.442 1.877s1.153.322 2.577.322h1.542c.973 0 1.81.5 2.002 1.195v-7.17c-.62-.6-1.313-.955-2.626-.955Z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M12.625 9.875h.919c1.423 0 2.135 0 2.577.322s.442.84.442 1.876v2.533c0 1.037 0 1.555-.442 1.877s-1.154.322-2.577.322h-1.543c-.973 0-1.81.5-2.001 1.195v-7.17c.62-.6 1.313-.955 2.625-.955Z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Onboarding.displayName = 'Onboarding';
