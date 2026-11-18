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

export const TestCaseResolution: FC<Props> = ({
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
      d="M6.402 3.2c-1.244.037-1.986.175-2.5.689-.703.704-.703 1.836-.703 4.1v5.206c0 2.265 0 3.397.703 4.1C4.605 18 5.736 18 8 18h4c2.263 0 3.394 0 4.097-.703.703-.704.703-1.836.703-4.101V7.99c0-2.265 0-3.397-.703-4.101-.513-.514-1.255-.652-2.5-.69"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M6.395 3.4a1.4 1.4 0 0 1 1.4-1.4h4.4a1.4 1.4 0 1 1 0 2.8h-4.4a1.4 1.4 0 0 1-1.4-1.4m-.797 5.002h3.2m2.402.8s.4 0 .8.8c0 0 1.27-2 2.4-2.4m-8.802 5.601h3.2m2.402.799s.4 0 .8.8c0 0 1.27-2 2.4-2.4"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
TestCaseResolution.displayName = 'TestCaseResolution';
