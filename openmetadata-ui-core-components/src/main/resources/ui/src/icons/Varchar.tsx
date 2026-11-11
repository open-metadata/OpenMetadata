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

export const Varchar: FC<Props> = ({
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
      d="M16.4 14.802v-9.6m-11.2 11.2h9.6m0-12.8H5.2m-1.6 1.6v9.6M6.8 8.4c-.235-1.254.588-1.552 3.166-1.6 2.398.055 3.386.245 3.166 1.6M9.966 6.8v6.4m0 0H8.779m1.187 0h1.187M17.2 2h-1.6a.8.8 0 0 0-.8.8v1.6a.8.8 0 0 0 .8.8h1.6a.8.8 0 0 0 .8-.8V2.8a.8.8 0 0 0-.8-.8ZM4.4 2H2.8a.8.8 0 0 0-.8.8v1.6a.8.8 0 0 0 .8.8h1.6a.8.8 0 0 0 .8-.8V2.8a.8.8 0 0 0-.8-.8Zm12.8 12.8h-1.6a.8.8 0 0 0-.8.8v1.6a.8.8 0 0 0 .8.8h1.6a.8.8 0 0 0 .8-.8v-1.6a.8.8 0 0 0-.8-.8Zm-12.8 0H2.8a.8.8 0 0 0-.8.8v1.6a.8.8 0 0 0 .8.8h1.6a.8.8 0 0 0 .8-.8v-1.6a.8.8 0 0 0-.8-.8Z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Varchar.displayName = 'Varchar';
