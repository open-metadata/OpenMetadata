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

export const FullScreen: FC<Props> = ({
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
      d="M2 10c0-3.771 0-5.657 1.172-6.828S6.229 2 10 2s5.657 0 6.828 1.172S18 6.229 18 10s0 5.657-1.172 6.828S13.771 18 10 18s-5.657 0-6.828-1.172S2 13.771 2 10Z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M5.625 5.65c-.484.485-.403 2.541-.403 2.541m.403-2.54c.484-.484 2.54-.404 2.54-.404m-2.54.404 3.383 3.382m5.346 5.336c-.484.484-2.54.403-2.54.403m2.54-.403c.484-.484.403-2.54.403-2.54m-.403 2.54-3.38-3.38"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
FullScreen.displayName = 'FullScreen';
