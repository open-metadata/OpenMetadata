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
import { Viewport } from 'reactflow';
import { getAbsolutePosition } from './ViewportUtils';

describe('ViewportUtils', () => {
  describe('getAbsolutePosition', () => {
    it('calculates absolute position with zoom and offset', () => {
      const viewport: Viewport = {
        x: 100,
        y: 50,
        zoom: 1,
      };

      const result = getAbsolutePosition(200, 150, viewport);

      expect(result).toEqual({
        position: 'absolute',
        left: '300px',
        top: '200px',
      });
    });

    it('applies zoom scaling correctly', () => {
      const viewport: Viewport = {
        x: 0,
        y: 0,
        zoom: 2,
      };

      const result = getAbsolutePosition(100, 100, viewport);

      expect(result).toEqual({
        position: 'absolute',
        left: '200px',
        top: '200px',
      });
    });

    it('handles negative viewport offsets', () => {
      const viewport: Viewport = {
        x: -100,
        y: -50,
        zoom: 1,
      };

      const result = getAbsolutePosition(200, 150, viewport);

      expect(result).toEqual({
        position: 'absolute',
        left: '100px',
        top: '100px',
      });
    });

    it('handles zoom less than 1', () => {
      const viewport: Viewport = {
        x: 0,
        y: 0,
        zoom: 0.5,
      };

      const result = getAbsolutePosition(100, 100, viewport);

      expect(result).toEqual({
        position: 'absolute',
        left: '50px',
        top: '50px',
      });
    });

    it('combines zoom and offset correctly', () => {
      const viewport: Viewport = {
        x: 50,
        y: 25,
        zoom: 1.5,
      };

      const result = getAbsolutePosition(100, 80, viewport);

      expect(result).toEqual({
        position: 'absolute',
        left: '200px',
        top: '145px',
      });
    });

    it('handles zero coordinates', () => {
      const viewport: Viewport = {
        x: 100,
        y: 100,
        zoom: 1,
      };

      const result = getAbsolutePosition(0, 0, viewport);

      expect(result).toEqual({
        position: 'absolute',
        left: '100px',
        top: '100px',
      });
    });

    it('handles negative coordinates', () => {
      const viewport: Viewport = {
        x: 0,
        y: 0,
        zoom: 1,
      };

      const result = getAbsolutePosition(-50, -30, viewport);

      expect(result).toEqual({
        position: 'absolute',
        left: '-50px',
        top: '-30px',
      });
    });
  });
});
