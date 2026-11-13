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

export const AiAssetsFilled: FC<Props> = ({
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
      d="M9.65 4.091c.127-.071.191-.107.259-.12a.5.5 0 0 1 .181 0c.068.013.132.049.26.12l3.333 1.86c.135.076.202.113.251.167a.5.5 0 0 1 .097.164c.023.07.023.147.023.302v3.673c0 .155 0 .233-.023.302a.5.5 0 0 1-.097.164c-.049.054-.116.092-.251.167l-3.333 1.86c-.128.071-.192.107-.26.121a.5.5 0 0 1-.181 0c-.068-.014-.132-.05-.26-.12L6.316 10.89c-.135-.075-.202-.113-.251-.167a.5.5 0 0 1-.097-.164c-.023-.07-.023-.147-.023-.302V6.584c0-.155 0-.232.023-.302a.5.5 0 0 1 .097-.164c.049-.054.116-.091.251-.167z"
      fill="currentColor"
      stroke="none"
    />
    <path
      d="M13.828 6.284 10 8.42m0 0L6.171 6.284M9.999 8.42v4.298m4.055-2.462V6.584c0-.155 0-.232-.023-.302a.5.5 0 0 0-.097-.164c-.049-.054-.116-.091-.25-.166h-.001l-3.333-1.86c-.128-.072-.192-.108-.26-.122a.5.5 0 0 0-.181 0c-.068.014-.132.05-.26.121l-3.333 1.86c-.135.076-.202.113-.251.167a.5.5 0 0 0-.097.164c-.023.07-.023.147-.023.302v3.673c0 .155 0 .233.023.302q.03.092.097.164c.049.054.116.091.25.166h.001l3.333 1.861c.128.071.192.107.26.121q.09.018.181 0c.068-.014.132-.05.26-.12l3.333-1.861h.001c.134-.076.201-.113.25-.167a.5.5 0 0 0 .097-.164c.023-.07.023-.147.023-.302"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      className="tw:stroke-bg-primary"
      d="M15.919 5.398 10 8.418m0 0v5.122m0-5.122L7.163 6.797 4.879 5.398"
      stroke="#fff"
      strokeWidth={1.3}
    />
    <path
      d="M11.13 15.447a1.205 1.205 0 1 1-2.41 0 1.205 1.205 0 0 1 2.41 0M4.56 4.28a1.28 1.28 0 1 1-2.56 0 1.28 1.28 0 0 1 2.56 0m13.44 0a1.28 1.28 0 1 1-2.56 0 1.28 1.28 0 0 1 2.56 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
AiAssetsFilled.displayName = 'AiAssetsFilled';
