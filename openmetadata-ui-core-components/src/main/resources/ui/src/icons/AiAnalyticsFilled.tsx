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

export const AiAnalyticsFilled: FC<Props> = ({
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
      d="M9.61 3.43H6.327c-1.314 0-1.97 0-2.472.255-.442.225-.8.584-1.025 1.025-.256.502-.256 1.159-.256 2.472v6.567c0 1.313 0 1.97.256 2.472.225.441.583.8 1.025 1.025.501.255 1.158.255 2.472.255h6.566c1.314 0 1.97 0 2.472-.255.442-.225.8-.584 1.025-1.025.256-.502.256-1.159.256-2.472v-3.283m-3.909.781v3.127m-6.254-4.69v4.69M9.61 6.557v7.817"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      clipRule="evenodd"
      d="M12.233 5.117a3 3 0 0 1-.247.056h-.004l-.004.001-.03.006h-.006c-.115.023-.115.187 0 .209h.005l.03.006.005.001h.004a3 3 0 0 1 .425.11 3.18 3.18 0 0 1 2.117 2.434l.001.003v.005c.002.007.004.014.006.03l.001.006c.022.115.187.115.209 0v-.006l.006-.03v-.005l.002-.003a4 4 0 0 1 .056-.248q.024-.09.053-.178a3.18 3.18 0 0 1 2.433-2.117h.003l.005-.002q.009 0 .03-.005l.006-.001c.115-.022.115-.186 0-.208l-.005-.001-.017-.003-.014-.003h-.005l-.003-.001a4 4 0 0 1-.247-.056 3.17 3.17 0 0 1-2.295-2.487l-.001-.003-.001-.005-.002-.01-.003-.02-.002-.006c-.021-.115-.186-.115-.208 0v.006l-.006.03v.005l-.002.003a4 4 0 0 1-.056.248 3.18 3.18 0 0 1-2.239 2.239Z"
      fill="currentColor"
      fillRule="evenodd"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
AiAnalyticsFilled.displayName = 'AiAnalyticsFilled';
