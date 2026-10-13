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

export const AppDataRetention: FC<Props> = ({
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
      d="M12.8 2v3.2M6.397 2v3.2m10.322 1.598c-.103-1.04-.334-1.74-.857-2.263-.937-.937-2.446-.937-5.463-.937H8.8c-3.017 0-4.526 0-5.463.937s-.938 2.446-.938 5.463v1.6c0 3.018 0 4.526.938 5.464.646.646 1.565.847 3.063.91M2.398 8.398h4"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M12.8 18a4.8 4.8 0 1 0 0-9.602 4.8 4.8 0 0 0 0 9.601"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M12.8 10.797V12.9c0 .108 0 .162.017.21q.022.064.07.112c.035.036.083.06.18.108l1.334.667"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
AppDataRetention.displayName = 'AppDataRetention';
