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

export const DataAssetsCoverage: FC<Props> = ({
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
      d="M9.997 8.4c1.767 0 3.2-.537 3.2-1.2S11.764 6 9.997 6s-3.2.537-3.2 1.2 1.433 1.2 3.2 1.2m3.2 1.6c0 .663-1.433 1.2-3.2 1.2s-3.2-.537-3.2-1.2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M13.197 7.2v5.6c0 .662-1.433 1.2-3.2 1.2s-3.2-.538-3.2-1.2V7.2M1.996 3.6a1.6 1.6 0 1 0 3.2 0 1.6 1.6 0 0 0-3.2 0m2.894.94.912.66M1.996 16.4a1.6 1.6 0 1 0 3.198 0 1.6 1.6 0 0 0-3.198 0m2.894-.938.911-.661M14.797 3.6a1.6 1.6 0 1 0 3.2 0 1.6 1.6 0 0 0-3.2 0m.306.94-.912.66m.606 11.2a1.6 1.6 0 1 0 3.2 0 1.6 1.6 0 0 0-3.2 0m.305-.938-.91-.661"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
DataAssetsCoverage.displayName = 'DataAssetsCoverage';
