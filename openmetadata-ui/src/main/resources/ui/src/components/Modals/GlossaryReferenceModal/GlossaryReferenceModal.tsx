/*
 *  Copyright 2021 Collate
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

import { cloneDeep, isEqual } from 'lodash';
import React, { useState } from 'react';
import { TermReference } from '../../../generated/entity/data/glossaryTerm';
import { errorMsg, isValidUrl } from '../../../utils/CommonUtils';
import { Button } from '../../buttons/Button/Button';
import GlossaryReferences from '../../GlossaryReferences/GlossaryReferences';

type RelatedTermsModalProp = {
  referenceList?: Array<TermReference>;
  onCancel: () => void;
  onSave: (references: Array<TermReference>) => void;
  header: string;
};

const GlossaryReferenceModal = ({
  referenceList,
  onCancel,
  onSave,
  header,
}: RelatedTermsModalProp) => {
  const [references, setReferences] = useState<TermReference[]>(
    cloneDeep(referenceList) || []
  );
  const [errMsg, setErrMsg] = useState<string>();

  const handleReferenceFieldChange = (refs: TermReference[]) => {
    setReferences(refs);
    setErrMsg('');
  };

  const isValid = (refs: TermReference[]): boolean => {
    let retVal = true;
    for (const ref of refs) {
      if (!isValidUrl(ref.endpoint || '')) {
        retVal = false;

        break;
      }
    }

    return retVal;
  };

  const handleSave = () => {
    const refList = references
      .map((item) => ({
        name: item.name?.trim(),
        endpoint: item.endpoint?.trim(),
      }))
      .filter((item) => item.name && item.endpoint);
    if (isValid(refList)) {
      if (!isEqual(referenceList, refList)) {
        onSave(refList);
      } else {
        onCancel();
      }
    } else {
      setErrMsg('Endpoints should be valid URL.');
    }
  };

  return (
    <dialog className="tw-modal" data-testid="modal-container">
      <div className="tw-modal-backdrop" onClick={() => onCancel()} />
      <div className="tw-modal-container tw-overflow-y-auto tw-max-w-3xl tw-max-h-screen">
        <div className="tw-modal-header">
          <p className="tw-modal-title tw-text-grey-body" data-testid="header">
            {header}
          </p>
        </div>
        <div className="tw-modal-body">
          <GlossaryReferences
            referenceList={references}
            onReferenceFieldChange={handleReferenceFieldChange}
          />
          {errMsg && errorMsg(errMsg)}
        </div>
        <div className="tw-modal-footer" data-testid="cta-container">
          <Button
            data-testid="cancelButton"
            size="regular"
            theme="primary"
            variant="link"
            onClick={onCancel}>
            Cancel
          </Button>
          <Button
            data-testid="saveButton"
            size="regular"
            theme="primary"
            type="submit"
            variant="contained"
            onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>
    </dialog>
  );
};

export default GlossaryReferenceModal;
