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

import { FileType } from '../../../generated/entity/data/contextFile';
import { PreviewRendererId, ResolveRendererArgs } from './FilePreviewer.types';
import { resolveRenderer } from './FilePreviewer.utils';

const resolve = (a: ResolveRendererArgs) => resolveRenderer(a);

describe('resolveRenderer', () => {
  it('maps pdf by fileType', () => {
    expect(resolve({ fileType: FileType.PDF })).toBe(PreviewRendererId.Pdf);
  });

  it('maps raster images by fileType', () => {
    expect(resolve({ fileType: FileType.Image, fileExtension: 'png' })).toBe(
      PreviewRendererId.Image
    );
  });

  it('maps svg to the image renderer (safe via <img> src, scripts inert)', () => {
    expect(resolve({ fileType: FileType.Image, fileExtension: 'svg' })).toBe(
      PreviewRendererId.Image
    );
    expect(
      resolve({ fileType: FileType.Image, mimeType: 'image/svg+xml' })
    ).toBe(PreviewRendererId.Image);
  });

  it('maps plain text by fileType', () => {
    expect(resolve({ fileType: FileType.Text })).toBe(PreviewRendererId.Text);
  });

  it('maps markdown within Text by extension or mime', () => {
    expect(resolve({ fileType: FileType.Text, fileExtension: 'md' })).toBe(
      PreviewRendererId.Markdown
    );
    expect(
      resolve({ fileType: FileType.Text, mimeType: 'text/markdown' })
    ).toBe(PreviewRendererId.Markdown);
  });

  it('maps CSV to the text renderer', () => {
    expect(resolve({ fileType: FileType.CSV })).toBe(PreviewRendererId.Text);
  });

  it('returns Unsupported for file types with no renderer yet', () => {
    expect(resolve({ fileType: FileType.Document })).toBe(
      PreviewRendererId.Unsupported
    );
  });

  it('falls back to mime-based classification when fileType is absent', () => {
    expect(resolve({ mimeType: 'application/pdf' })).toBe(
      PreviewRendererId.Pdf
    );
    expect(resolve({ mimeType: 'image/svg+xml' })).toBe(
      PreviewRendererId.Image
    );
  });

  it('returns Unsupported for an empty input', () => {
    expect(resolve({})).toBe(PreviewRendererId.Unsupported);
  });
});
