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

import React, { PropsWithChildren, useCallback, useState } from 'react';
import TestCaseFormDrawer from '../../DataQuality/AddDataQualityTest/components/TestCaseFormDrawer';
import BundleSuiteFormDrawer from '../../DataQuality/BundleSuiteForm/BundleSuiteFormDrawer';
import { Intent } from '../../platform/ai-shell/AppModule.types';
import { useIntent } from '../../platform/ai-shell/useIntent';

const ObservabilityLayout: React.FC<PropsWithChildren> = ({ children }) => {
  const [isAddBundleSuiteOpen, setIsAddBundleSuiteOpen] = useState(false);
  const [isAddTestCaseOpen, setIsAddTestCaseOpen] = useState(false);

  useIntent(
    Intent.AddTestCase,
    useCallback(() => setIsAddTestCaseOpen(true), [])
  );
  useIntent(
    Intent.AddBundleSuite,
    useCallback(() => setIsAddBundleSuiteOpen(true), [])
  );

  const handleCloseBundleSuite = useCallback(
    () => setIsAddBundleSuiteOpen(false),
    []
  );

  const handleClose = useCallback(() => setIsAddTestCaseOpen(false), []);

  return (
    <div
      className="tw:flex tw:min-h-full tw:flex-col"
      data-testid="observability-layout">
      {children}
      <BundleSuiteFormDrawer
        open={isAddBundleSuiteOpen}
        variant="modal"
        onClose={handleCloseBundleSuite}
        onSuccess={handleCloseBundleSuite}
      />
      <TestCaseFormDrawer
        open={isAddTestCaseOpen}
        variant="modal"
        onClose={handleClose}
        onFormSubmit={handleClose}
      />
    </div>
  );
};

export default ObservabilityLayout;
