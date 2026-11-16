/*
 *  Copyright 2026 Collate.
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
import type { FC, SVGProps } from 'react';

interface Props extends SVGProps<SVGSVGElement> {
  color?: string;
  size?: number;
}

export const ConstraintKeyRemoved: FC<Props> = ({
  size = 20,
  color: _color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    viewBox="0 0 16 16"
    width={size}
    {...props}>
    <g clipPath="url(#constraint-key-removed_a)">
      <path
        d="M10.468 0A5.414 5.414 0 0 0 5.41 7.327l-5.17 5.17a.4.4 0 0 0-.116.28v2.829c0 .218.177.394.394.394H2.85a.4.4 0 0 0 .279-.115l.785-.785a.4.4 0 0 0 .116-.279v-.965h.964a.394.394 0 0 0 .394-.394v-.386h.386a.394.394 0 0 0 .394-.394v-.848h.848a.4.4 0 0 0 .279-.115l1.254-1.254a5.414 5.414 0 0 0 7.327-5.057A5.414 5.414 0 0 0 10.468 0m0 10.027c-.645 0-1.269-.13-1.854-.387a.39.39 0 0 0-.434.079l-.003.003-1.324 1.324H5.774a.394.394 0 0 0-.394.394v.848h-.386a.394.394 0 0 0-.394.394v.386h-.964a.394.394 0 0 0-.394.394v1.196l-.555.554H.913v-.557l4.816-4.817a.355.355 0 1 0-.501-.502L.913 13.652v-.712l5.24-5.241.003-.004a.39.39 0 0 0 .08-.433A4.625 4.625 0 0 1 10.468.788a4.625 4.625 0 0 1 4.619 4.62 4.625 4.625 0 0 1-4.62 4.62"
        fill="#9F9F9F"
      />
      <path
        d="M12.114 2.286c-.814 0-1.477.662-1.477 1.476s.663 1.476 1.477 1.476 1.476-.662 1.476-1.476-.662-1.476-1.476-1.476m0 2.164a.689.689 0 1 1 .001-1.378.689.689 0 0 1-.001 1.378"
        fill="#9F9F9F"
      />
      <path d="M0 8h16" stroke="gray" />
    </g>
    <defs>
      <clipPath id="constraint-key-removed_a">
        <path d="M0 0h16v16H0z" fill="#fff" />
      </clipPath>
    </defs>
  </svg>
);
ConstraintKeyRemoved.displayName = 'ConstraintKeyRemoved';
