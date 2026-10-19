/*
 *  Copyright 2024 Collate.
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
import PermissionPlaceholder from '../../components/common/EmptyPlaceholder/PermissionPlaceholder';
import { withPageLayout } from '../../hoc/withPageLayout';

const ForbiddenPage = () => {
  return (
    <div className="tw:relative tw:h-full tw:w-full tw:min-h-60 tw:rounded-xl tw:bg-surface">
      <PermissionPlaceholder data-testid="permission-error-placeholder" />
    </div>
  );
};

export default withPageLayout(ForbiddenPage);
