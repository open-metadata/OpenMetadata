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

export const DateType: FC<Props> = ({
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
      d="M10 14.702v.1m.2 0a.2.2 0 1 1-.4 0 .2.2 0 0 1 .4 0m-.2-3.304v.1m.2 0a.2.2 0 1 1-.4 0 .2.2 0 0 1 .4 0m-4 3.104v.1m.2 0a.2.2 0 1 1-.4 0 .2.2 0 0 1 .4 0m-.2-3.304v.1m.2 0a.2.2 0 1 1-.4 0 .2.2 0 0 1 .4 0m7.402-.1v.1m.2 0a.2.2 0 1 1-.4 0 .2.2 0 0 1 .4 0M13.2 2v3.2M6.8 2v3.2m-4 3.198h14.401"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M10.801 3.602h-1.6c-3.017 0-4.526 0-5.463.937s-.937 2.446-.937 5.463v1.6c0 3.017 0 4.525.937 5.463s2.446.937 5.463.937h1.6c3.017 0 4.526 0 5.463-.937s.937-2.446.937-5.463v-1.6c0-3.017 0-4.526-.937-5.463s-2.446-.937-5.463-.937"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
DateType.displayName = 'DateType';
