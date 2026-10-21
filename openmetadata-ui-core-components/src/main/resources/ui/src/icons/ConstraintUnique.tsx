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

export const ConstraintUnique: FC<Props> = ({
  size = 20,
  color: _color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    height={size}
    viewBox="0 0 219.781 219.781"
    width={size}
    xmlSpace="preserve"
    {...props}>
    <path
      d="m202.314 154.591-22.323-12.888 19.345-11.407a7.5 7.5 0 1 0-7.619-12.921l-26.648 15.713-40.179-23.198 40.172-23.194 26.656 15.711a7.497 7.497 0 0 0 10.269-2.654 7.5 7.5 0 0 0-2.653-10.27L179.986 78.08l22.328-12.891a7.5 7.5 0 0 0-7.5-12.99l-22.323 12.889-.203-22.461c-.037-4.142-3.435-7.489-7.567-7.432a7.5 7.5 0 0 0-7.432 7.567l.279 30.941L117.391 96.9V50.51l26.937-15.224a7.5 7.5 0 0 0-7.381-13.059L117.391 33.28V7.5a7.5 7.5 0 0 0-15 0v25.78L82.835 22.228a7.5 7.5 0 0 0-7.381 13.059l26.936 15.224V96.9L62.213 73.703l.279-30.941a7.5 7.5 0 0 0-7.432-7.567h-.069a7.5 7.5 0 0 0-7.498 7.433l-.203 22.46-22.323-12.889a7.5 7.5 0 0 0-7.5 12.99L39.794 78.08 20.443 89.485a7.501 7.501 0 0 0 7.617 12.924l26.659-15.711 40.173 23.194-40.18 23.198-26.652-15.716a7.5 7.5 0 0 0-10.27 2.651 7.5 7.5 0 0 0 2.651 10.269l19.348 11.408-22.323 12.888a7.5 7.5 0 0 0 7.5 12.99l22.323-12.889.203 22.462a7.5 7.5 0 0 0 7.498 7.433l.069-.001a7.5 7.5 0 0 0 7.432-7.567l-.279-30.942 40.178-23.197v46.391l-26.936 15.224a7.5 7.5 0 0 0 7.381 13.059l19.556-11.052v25.78a7.5 7.5 0 0 0 15 0v-25.78l19.556 11.052a7.5 7.5 0 0 0 10.22-2.839 7.5 7.5 0 0 0-2.839-10.22l-26.937-15.224v-46.39l40.177 23.196-.286 30.941a7.5 7.5 0 0 0 7.43 7.569l.071.001a7.5 7.5 0 0 0 7.498-7.431l.208-22.465 22.326 12.89a7.5 7.5 0 0 0 10.245-2.745 7.5 7.5 0 0 0-2.746-10.245"
      data-original="#37352f"
      fill="currentColor"
    />
  </svg>
);
ConstraintUnique.displayName = 'ConstraintUnique';
