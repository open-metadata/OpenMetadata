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

export const AppTelemetry: FC<Props> = ({
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
      d="m15.601 17.997-4-7.2-4 7.2m5.534-14.399L6.02 7.802a1.704 1.704 0 0 0-.601 2.298l.821 1.456a1.62 1.62 0 0 0 2.244.616L15.6 7.967m-2.223-4.003a1.31 1.31 0 0 1 2.267-1.309l2.181 3.78a1.31 1.31 0 0 1-2.267 1.31zM2 11.81l.59 1.095m0 0 .591 1.094m-.59-1.094L5.6 11.199"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
AppTelemetry.displayName = 'AppTelemetry';
