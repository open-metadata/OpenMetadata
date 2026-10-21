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

export const ConstraintForeignKeyRemoved: FC<Props> = ({
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
    <g clipPath="url(#constraint-foreign-key-removed_a)">
      <path
        d="M12.678 11.117c-.864 0-1.561.704-1.561 1.561 0 .858.704 1.562 1.561 1.562.864 0 1.562-.704 1.562-1.562 0-.857-.698-1.561-1.562-1.561m0 2.342a.773.773 0 0 1-.774-.774.773.773 0 1 1 1.549 0 .773.773 0 0 1-.775.774"
        fill="#9F9F9F"
      />
      <path
        d="M12.678 9.363a3.31 3.31 0 0 0-2.764 1.504l-.352.538v-5.35h.966v1.363c0 .217.18.39.397.39h4.678c.218 0 .39-.18.39-.39V.397a.39.39 0 0 0-.39-.39h-4.678a.39.39 0 0 0-.39.39v4.87H9.17c-.217 0-.39.18-.39.39v5.46H7.226V3.315c0-.217-.18-.39-.39-.39h-1.37V.39c0-.217-.18-.39-.39-.39H.39C.18 0 0 .18 0 .39v7.021c0 .218.18.39.39.39h4.68c.217 0 .39-.179.39-.39V3.712h.967v7.405H2.138a.43.43 0 0 0-.218.064L.173 12.352a.4.4 0 0 0-.173.326c0 .135.064.256.173.327l1.753 1.171a.4.4 0 0 0 .218.064h1.664l.038.02 1.05.524a.4.4 0 0 0 .352-.006l.909-.455.083-.045.083.045.909.455a.4.4 0 0 0 .173.044.36.36 0 0 0 .179-.044l1.043-.525.039-.02H9.74l.057.097a3.32 3.32 0 0 0 6.196-1.664c.006-1.818-1.485-3.303-3.316-3.303m-1.356-7.801V.787h3.897v.967h-3.897zm0 5.267V2.54h3.897v4.48h-3.897zM.787 1.562V.787h3.898v.967H.787zm3.891 1.17v4.289H.788V2.54h3.897zm8 12.48a2.53 2.53 0 0 1-2.316-1.516.4.4 0 0 0-.359-.237H8.59a.4.4 0 0 0-.173.039l-.909.454-.083.045-.083-.045-.909-.454a.4.4 0 0 0-.352.006l-.922.448-.083.045-.083-.045-.909-.454a.4.4 0 0 0-.173-.045H2.266l-.052-.032-.87-.583-.237-.16.237-.16.877-.582.051-.032h7.731c.154 0 .301-.09.359-.237a2.53 2.53 0 0 1 2.316-1.517 2.54 2.54 0 0 1 2.535 2.535 2.53 2.53 0 0 1-2.535 2.528"
        fill="#9F9F9F"
      />
      <path d="M0 8h16" stroke="gray" />
    </g>
    <defs>
      <clipPath id="constraint-foreign-key-removed_a">
        <path d="M0 0h16v16H0z" fill="#fff" />
      </clipPath>
    </defs>
  </svg>
);
ConstraintForeignKeyRemoved.displayName = 'ConstraintForeignKeyRemoved';
