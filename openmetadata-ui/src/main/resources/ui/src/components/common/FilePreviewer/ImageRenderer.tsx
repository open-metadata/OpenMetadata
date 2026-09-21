/*
 *  Copyright OpenMetadata Collective SPDX-License-Identifier: Apache-2.0
 */

import { PreviewRendererProps } from './FilePreviewer.interface';

const ImageRenderer = ({ fileName, objectUrl }: PreviewRendererProps) => (
  <div className="tw:flex tw:justify-center tw:p-4">
    <img
      alt={fileName ?? ''}
      className="tw:max-w-full tw:max-h-[75vh] tw:object-contain"
      src={objectUrl}
    />
  </div>
);

export default ImageRenderer;
