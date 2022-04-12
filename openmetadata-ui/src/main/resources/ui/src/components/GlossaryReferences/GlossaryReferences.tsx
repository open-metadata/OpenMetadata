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

import React, { FunctionComponent, useEffect, useState } from 'react';
import { TermReference } from '../../generated/entity/data/glossaryTerm';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { Button } from '../buttons/Button/Button';
import { Field } from '../Field/Field';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

interface Props {
  referenceList: TermReference[];
  onReferenceFieldChange: (newRefList: TermReference[]) => void;
}

const GlossaryReferences: FunctionComponent<Props> = ({
  referenceList,
  onReferenceFieldChange,
}: Props) => {
  const [references, setReferences] = useState<TermReference[]>(
    referenceList || []
  );

  const handleReferenceFieldsChange = (
    i: number,
    field: keyof TermReference,
    value: string
  ) => {
    const newFormValues = [...references];
    newFormValues[i][field] = value;
    onReferenceFieldChange(newFormValues);
  };

  const addReferenceFields = () => {
    onReferenceFieldChange([...references, { name: '', endpoint: '' }]);
  };

  const removeReferenceFields = (i: number) => {
    const newFormValues = [...references];
    newFormValues.splice(i, 1);
    onReferenceFieldChange(newFormValues);
  };

  useEffect(() => {
    setReferences(referenceList);
  }, [referenceList]);

  return (
    <div data-testid="references">
      <div className="tw-flex tw-items-center">
        <p className="w-form-label tw-mr-3">References</p>
        <Button
          className="tw-h-5 tw-px-2"
          size="x-small"
          theme="primary"
          variant="contained"
          onClick={addReferenceFields}>
          <FontAwesomeIcon icon="plus" />
        </Button>
      </div>

      {references.map((value, i) => (
        <div className="tw-flex tw-items-center" key={i}>
          <div className="tw-grid tw-grid-cols-2 tw-gap-x-2 tw-w-11/12">
            <Field>
              <input
                className="tw-form-inputs tw-px-3 tw-py-1"
                id={`name-${i}`}
                name="name"
                placeholder="Name"
                type="text"
                value={value.name}
                onChange={(e) =>
                  handleReferenceFieldsChange(i, 'name', e.target.value)
                }
              />
            </Field>
            <Field>
              <input
                className="tw-form-inputs tw-px-3 tw-py-1"
                id={`url-${i}`}
                name="endpoint"
                placeholder="Endpoint"
                type="text"
                value={value.endpoint}
                onChange={(e) =>
                  handleReferenceFieldsChange(i, 'endpoint', e.target.value)
                }
              />
            </Field>
          </div>
          <button
            className="focus:tw-outline-none tw-mt-3 tw-w-1/12"
            onClick={(e) => {
              removeReferenceFields(i);
              e.preventDefault();
            }}>
            <SVGIcons
              alt="delete"
              icon={Icons.DELETE}
              title="Delete"
              width="12px"
            />
          </button>
        </div>
      ))}
    </div>
  );
};

export default GlossaryReferences;
