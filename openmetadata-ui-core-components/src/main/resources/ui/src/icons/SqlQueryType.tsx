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

export const SqlQueryType: FC<Props> = ({
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
      d="M2 10c0-3.771 0-5.657 1.172-6.828S6.229 2 10 2s5.657 0 6.828 1.172S18 6.229 18 10s0 5.657-1.172 6.828S13.771 18 10 18s-5.657 0-6.828-1.172S2 13.771 2 10"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M6.982 8.315A1.264 1.264 0 1 0 5.79 9.999a1.263 1.263 0 1 1-1.19 1.684m5.82.842a1.263 1.263 0 0 1-1.264-1.263V8.736a1.263 1.263 0 0 1 2.527 0v2.526c0 .698-.566 1.263-1.264 1.263m0 0 1.263 1.263m2.108-6.315v3.368c0 .794 0 1.191.246 1.438s.643.246 1.437.246"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
SqlQueryType.displayName = 'SqlQueryType';
