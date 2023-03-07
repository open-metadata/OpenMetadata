/*
 *  Copyright 2023 Collate.
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
import { SkeletonProps } from 'antd';
import { SkeletonButtonProps } from 'antd/lib/skeleton/Button';
import { TitleBreadcrumbProps } from '../common/title-breadcrumb/title-breadcrumb.interface';

export interface Key {
  key?: React.Key | null | undefined;
}

export interface Children {
  children: JSX.Element;
}
export interface SkeletonInterface extends Children {
  loading: boolean;
  dataLength?: number;
}
export interface TitleBreadcrumbSkeletonProps extends Children {
  titleLinks: TitleBreadcrumbProps['titleLinks'];
}

export interface ButtonSkeletonProps
  extends SkeletonButtonProps,
    Partial<Key> {}

export interface LabelCountSkeletonProps extends SkeletonProps, Partial<Key> {
  isSelect?: boolean;
  isLabel?: boolean;
  isCount?: boolean;
  labelProps?: SkeletonProps;
  selectProps?: SkeletonProps;
  countProps?: SkeletonProps;
  firstColSize?: number;
  secondColSize?: number;
}

export type EntityListSkeletonProps = SkeletonInterface &
  Partial<LabelCountSkeletonProps>;
