/*
 *  Copyright 2022 Collate.
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

import AssignErrorPlaceHolder from './AssignErrorPlaceHolder';
import CreateErrorPlaceHolder from './CreateErrorPlaceHolder';
import CustomNoDataPlaceHolderNew from './CustomNoDataPlaceHolderNew';
import FilterErrorPlaceHolder from './FilterErrorPlaceHolder';
import NoDataPlaceholderNew from './NoDataPlaceholderNew';
import { NoDataPlaceholderProps } from './placeholder.interface';
import PermissionErrorPlaceholder from './PermissionErrorPlaceholder';

/**
 * New-design compound component. Each variant is a narrow-typed sub-component
 * that accepts only the props it consumes — pick one explicitly, e.g.
 * `<ErrorPlaceHolderNew.Permission permissionValue={…} />`. The bare
 * `<ErrorPlaceHolderNew>` renders the new-design no-data placeholder (the
 * historical default). No `.CoreCreate` — that variant is legacy-only.
 */
const ErrorPlaceHolderNewBase = (props: NoDataPlaceholderProps) => (
  <NoDataPlaceholderNew {...props} />
);

const ErrorPlaceHolderNew =
  ErrorPlaceHolderNewBase as typeof ErrorPlaceHolderNewBase & {
    Create: typeof CreateErrorPlaceHolder;
    Assign: typeof AssignErrorPlaceHolder;
    Filter: typeof FilterErrorPlaceHolder;
    Permission: typeof PermissionErrorPlaceholder;
    Custom: typeof CustomNoDataPlaceHolderNew;
    NoData: typeof NoDataPlaceholderNew;
  };

// Do NOT lazy-load this component. React.lazy resolves to a forwardRef wrapper
// that drops these static members, so `<LazyErrorPlaceHolderNew.NoData>` would be
// `undefined` at render with no compile-time error. Import the specific leaf
// (e.g. NoDataPlaceholderNew) directly when a lazy boundary is required.
ErrorPlaceHolderNew.Create = CreateErrorPlaceHolder;
ErrorPlaceHolderNew.Assign = AssignErrorPlaceHolder;
ErrorPlaceHolderNew.Filter = FilterErrorPlaceHolder;
ErrorPlaceHolderNew.Permission = PermissionErrorPlaceholder;
ErrorPlaceHolderNew.Custom = CustomNoDataPlaceHolderNew;
ErrorPlaceHolderNew.NoData = NoDataPlaceholderNew;

export default ErrorPlaceHolderNew;
