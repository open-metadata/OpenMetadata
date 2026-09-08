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

export const RequestedOn: FC<Props> = ({
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
      d="M13.2 2v3.2M6.8 2v3.2m4-1.598H9.2c-3.016 0-4.525 0-5.462.937S2.801 6.984 2.801 10v1.6c0 3.017 0 4.525.937 5.463S6.184 18 9.2 18h1.6c3.017 0 4.526 0 5.463-.937s.937-2.446.937-5.463V10c0-3.017 0-4.525-.937-5.462s-2.446-.937-5.463-.937m-8 4.801h14.4"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M10.1 11.598H10m.1 3.2H10m-3.5-3.2h-.1m.1 3.2h-.1m7.299-3.2h-.1m-3.4 0a.2.2 0 1 1-.4 0 .2.2 0 0 1 .4 0m0 3.2a.2.2 0 1 1-.4 0 .2.2 0 0 1 .4 0m-3.6-3.2a.2.2 0 1 1-.4 0 .2.2 0 0 1 .4 0m0 3.2a.2.2 0 1 1-.4 0 .2.2 0 0 1 .4 0m7.2-3.2a.2.2 0 1 1-.4 0 .2.2 0 0 1 .4 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
RequestedOn.displayName = 'RequestedOn';
