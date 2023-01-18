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

import { Select, Typography } from 'antd';
import { cloneDeep, isEmpty, isEqual } from 'lodash';
import React, { useEffect, useState } from 'react';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { OperationPermission } from '../../PermissionProvider/PermissionProvider.interface';
import SummaryDetail from '../SummaryDetail';

interface GlossaryTermSynonymsProps {
  permissions: OperationPermission;
  glossaryTerm: GlossaryTerm;
  onGlossaryTermUpdate: (glossaryTerm: GlossaryTerm) => void;
}

const GlossaryTermSynonyms = ({
  permissions,
  glossaryTerm,
  onGlossaryTermUpdate,
}: GlossaryTermSynonymsProps) => {
  const [isViewMode, setIsViewMode] = useState<boolean>(true);
  const [synonyms, setSynonyms] = useState<string[]>([]);
  const getSynonyms = () => {
    return !isEmpty(synonyms) ? (
      synonyms.map((synonym, index) => (
        <span key={index}>
          {index > 0 ? <span className="tw-mr-2">,</span> : null}
          <span>{synonym}</span>
        </span>
      ))
    ) : (
      <Typography.Text type="secondary">No synonyms available.</Typography.Text>
    );
  };

  const handleSynonymsSave = () => {
    if (!isEqual(synonyms, glossaryTerm.synonyms)) {
      let updatedGlossaryTerm = cloneDeep(glossaryTerm);
      updatedGlossaryTerm = {
        ...updatedGlossaryTerm,
        synonyms,
      };

      onGlossaryTermUpdate(updatedGlossaryTerm);
    }
    setIsViewMode(true);
  };

  useEffect(() => {
    if (glossaryTerm.synonyms?.length) {
      // removing empty string
      setSynonyms(glossaryTerm.synonyms.filter((synonym) => !isEmpty(synonym)));
    }
  }, [glossaryTerm]);

  return (
    <SummaryDetail
      hasAccess={permissions.EditAll}
      key="synonyms"
      setShow={() => setIsViewMode(false)}
      showIcon={isViewMode}
      title="Synonyms"
      onSave={handleSynonymsSave}>
      <div className="flex" data-testid="synonyms-container">
        {isViewMode ? (
          getSynonyms()
        ) : (
          <Select
            allowClear
            id="synonyms-select"
            mode="tags"
            placeholder="Add Synonyms"
            style={{ width: '100%' }}
            value={synonyms}
            onChange={(value) => setSynonyms(value)}
          />
        )}
      </div>
    </SummaryDetail>
  );
};

export default GlossaryTermSynonyms;
