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

import CoreCreateErrorPlaceHolder from '../CoreCreate/CoreCreateErrorPlaceHolder';
import AssignErrorPlaceHolder from './AssignErrorPlaceHolder';
import CreateErrorPlaceHolder from './CreateErrorPlaceHolder';
import CustomNoDataPlaceHolder from './CustomNoDataPlaceHolder';
import FilterErrorPlaceHolder from './FilterErrorPlaceHolder';
import NoDataPlaceholder from './NoDataPlaceholder';
import { NoDataPlaceholderProps } from './placeholder.interface';
import PermissionErrorPlaceholder from './PermissionErrorPlaceholder';

/**
 * Compound component. Each variant is a narrow-typed sub-component that accepts
 * only the props it actually consumes — pick one explicitly, e.g.
 * `<ErrorPlaceHolder.Permission permissionValue={…} />` or
 * `<ErrorPlaceHolder.Create heading={…} onClick={…} />`. The bare
 * `<ErrorPlaceHolder>` renders the no-data placeholder (the historical default).
 */
const ErrorPlaceHolderBase = (props: NoDataPlaceholderProps) => (
  <NoDataPlaceholder {...props} />
);

const ErrorPlaceHolder = ErrorPlaceHolderBase as typeof ErrorPlaceHolderBase & {
  Create: typeof CreateErrorPlaceHolder;
  CoreCreate: typeof CoreCreateErrorPlaceHolder;
  Assign: typeof AssignErrorPlaceHolder;
  Filter: typeof FilterErrorPlaceHolder;
  Permission: typeof PermissionErrorPlaceholder;
  Custom: typeof CustomNoDataPlaceHolder;
  NoData: typeof NoDataPlaceholder;
};

// Do NOT lazy-load this component. React.lazy resolves to a forwardRef wrapper
// that drops these static members, so `<LazyErrorPlaceHolder.NoData>` would be
// `undefined` at render with no compile-time error. Import the specific leaf
// (e.g. NoDataPlaceholder) directly when a lazy boundary is required.
ErrorPlaceHolder.Create = CreateErrorPlaceHolder;
ErrorPlaceHolder.CoreCreate = CoreCreateErrorPlaceHolder;
ErrorPlaceHolder.Assign = AssignErrorPlaceHolder;
ErrorPlaceHolder.Filter = FilterErrorPlaceHolder;
ErrorPlaceHolder.Permission = PermissionErrorPlaceholder;
ErrorPlaceHolder.Custom = CustomNoDataPlaceHolder;
ErrorPlaceHolder.NoData = NoDataPlaceholder;

export default ErrorPlaceHolder;
