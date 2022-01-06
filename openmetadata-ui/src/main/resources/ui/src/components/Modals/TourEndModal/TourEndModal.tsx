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

import React from 'react';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import { Button } from '../../buttons/Button/Button';
type TourEndModalProps = {
  onSave: () => void;
};
const TourEndModal = ({ onSave }: TourEndModalProps) => {
  return (
    <dialog className="tw-modal" data-testid="modal-container">
      <div className="tw-modal-backdrop" />
      <div className="tw-modal-container tw-overflow-y-auto tw-max-h-screen tw-w-120">
        <div className="tw-modal-body tw-min-h-32 tw-flex tw-flex-col tw-justify-center tw-items-center">
          <SVGIcons
            alt="OpenMetadata Logo"
            icon={Icons.LOGO_SMALL}
            width="70"
          />
          <p className="tw-text-base tw-text-center tw-mt-5">
            You’ve successfully completed the tour.
            <br />
            Get started with OpenMetadata.
          </p>
        </div>
        <div className="tw-modal-footer" data-testid="cta-container">
          <Button
            data-testid="saveButton"
            size="regular"
            theme="primary"
            type="submit"
            variant="contained"
            onClick={onSave}>
            Explore Now
          </Button>
        </div>
      </div>
    </dialog>
  );
};

export default TourEndModal;
