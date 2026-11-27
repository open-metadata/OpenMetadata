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

export const AiGovernanceFramework: FC<Props> = ({
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
      d="M10.8 2H9.2a.8.8 0 0 0-.8.8v1.6a.8.8 0 0 0 .8.8h1.6a.8.8 0 0 0 .8-.8V2.8a.8.8 0 0 0-.8-.8m0 12.8H9.2a.8.8 0 0 0-.8.8v1.6a.8.8 0 0 0 .8.8h1.6a.8.8 0 0 0 .8-.8v-1.6a.8.8 0 0 0-.8-.8m.802-11.198h1.6c1.13 0 1.696 0 2.048.351.351.351.351.917.351 2.048"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M8.402 3.602h-1.6c-1.131 0-1.697 0-2.048.351-.352.351-.352.917-.352 2.048m4 10.399h-1.6c-1.131 0-1.697 0-2.048-.352-.352-.351-.352-.917-.352-2.048m7.2 2.4h1.6c1.13 0 1.696 0 2.048-.352.351-.351.351-.917.351-2.048M8.4 10h3.2m5.6.802v-1.6a.8.8 0 0 0-.8-.8h-1.6a.8.8 0 0 0-.8.8v1.6a.8.8 0 0 0 .8.8h1.6a.8.8 0 0 0 .8-.8m-11.2 0v-1.6a.8.8 0 0 0-.8-.8H3.6a.8.8 0 0 0-.8.8v1.6a.8.8 0 0 0 .8.8h1.6a.8.8 0 0 0 .8-.8"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
AiGovernanceFramework.displayName = 'AiGovernanceFramework';
