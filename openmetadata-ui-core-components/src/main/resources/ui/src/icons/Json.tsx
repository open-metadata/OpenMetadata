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

export const Json: FC<Props> = ({
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
      d="M14.8 17.2c.986 0 1.786-.92 1.786-2.056 0-1.799-.08-2.994 1.153-4.416a1.14 1.14 0 0 0 0-1.454c-1.233-1.422-1.153-2.618-1.153-4.416 0-1.136-.8-2.057-1.785-2.057M5.2 17.2c-.986 0-1.785-.92-1.785-2.056 0-1.799.08-2.994-1.154-4.416a1.14 1.14 0 0 1 0-1.454c1.207-1.391 1.154-2.601 1.154-4.416 0-1.136.8-2.057 1.785-2.057"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <circle
      cx={6.788}
      cy={10.448}
      fill="currentColor"
      r={1.104}
      stroke="none"
    />
    <circle
      cx={10.243}
      cy={10.448}
      fill="currentColor"
      r={1.104}
      stroke="none"
    />
    <circle
      cx={13.696}
      cy={10.448}
      fill="currentColor"
      r={1.104}
      stroke="none"
    />
  </svg>
);
Json.displayName = 'Json';
