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

export const Map02: FC<Props> = ({
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
      d="M18 8.4v-.626c0-1.552 0-2.328-.469-2.81s-1.223-.482-2.731-.482h-1.663c-.734 0-.74-.001-1.4-.331L9.072 2.817C7.959 2.26 7.402 1.982 6.81 2s-1.131.333-2.207.962l-.983.573c-.79.462-1.185.693-1.403 1.077S2 5.463 2 6.399v6.574c0 1.228 0 1.842.274 2.184.182.228.437.38.72.431.424.077.943-.227 1.982-.833.705-.412 1.384-.84 2.228-.724.707.098 1.364.544 1.996.86M6.8 2v12m5.6-9.602v3.6"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M15.047 17.747a.95.95 0 0 1-.646.253.95.95 0 0 1-.647-.253c-1.588-1.497-3.717-3.168-2.679-5.595C11.637 10.84 12.984 10 14.401 10s2.764.84 3.326 2.152c1.036 2.424-1.087 4.104-2.68 5.595Z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M14.5 13.598h-.1m.2 0a.2.2 0 1 1-.4 0 .2.2 0 0 1 .4 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Map02.displayName = 'Map02';
