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

export const AiGovernancePolicy: FC<Props> = ({
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
    <path d="M10 6.367V17.2" stroke="currentColor" strokeWidth={1.3} />
    <path
      clipRule="evenodd"
      d="M13.42 4.303a2 2 0 0 1-.142.032h-.002l-.003.001-.017.003h-.003c-.066.013-.066.108 0 .12h.003l.017.004h.005a2 2 0 0 1 .244.064 1.82 1.82 0 0 1 1.216 1.396v.005l.003.017.001.004c.012.066.107.066.12 0v-.004l.003-.017v-.003l.001-.002.004-.02a2 2 0 0 1 .06-.224 1.82 1.82 0 0 1 1.396-1.215h.002l.002-.001.018-.003h.003c.066-.013.066-.108 0-.12h-.003l-.01-.003-.008-.001h-.004a2 2 0 0 1-.143-.033l-.102-.03a1.82 1.82 0 0 1-1.215-1.397V2.87l-.002-.006-.002-.011V2.85c-.013-.066-.107-.066-.12 0v.003l-.004.018v.005l-.004.02a2 2 0 0 1-.06.224 1.82 1.82 0 0 1-1.254 1.183Z"
      fill="currentColor"
      fillRule="evenodd"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M6 17.2h8M3.6 7.797h12.8m-12.8 0-1.6 4.8m1.6-4.8 1.6 4.8m-3.2.001a1.6 1.6 0 0 0 3.2 0m11.2-4.801-1.6 4.8m1.6-4.8 1.6 4.8m-3.2.001a1.6 1.6 0 0 0 3.2 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
AiGovernancePolicy.displayName = 'AiGovernancePolicy';
