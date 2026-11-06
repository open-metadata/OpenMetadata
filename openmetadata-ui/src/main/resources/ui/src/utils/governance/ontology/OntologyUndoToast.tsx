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
import {
  Box,
  Button,
  toast,
  Typography,
} from '@openmetadata/ui-core-components';
import i18n from '../../i18next/LocalUtil';

const UNDO_TOAST_MILLIS = 8000;

/** Shows a success toast whose Undo action runs once, then dismisses the toast. */
export const showUndoToast = (message: string, onUndo: () => Promise<void>) => {
  let key = '';
  let used = false;
  const undo = async () => {
    if (used) {
      return;
    }
    used = true;
    toast.dismiss(key);
    await onUndo();
  };
  key = toast.success(
    <Box align="center" gap={3}>
      <Typography as="span" size="text-sm">
        {message}
      </Typography>
      <Button
        color="link-color"
        data-testid="ontology-undo"
        size="sm"
        onPress={() => void undo()}>
        {i18n.t('label.undo')}
      </Button>
    </Box>,
    { timeout: UNDO_TOAST_MILLIS }
  );
};
