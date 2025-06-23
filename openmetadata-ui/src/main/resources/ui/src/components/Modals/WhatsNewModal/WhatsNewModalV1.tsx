/*
 *  Copyright 2025 Collate.
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
/* eslint-disable i18next/no-literal-string */
import { Button, Carousel, Menu, Modal } from 'antd';
import axios, { AxiosError } from 'axios';
import React, { useEffect, useState } from 'react';
import BlockEditor from '../../BlockEditor/BlockEditor';
import { ToggleType, WhatsNewModalProps } from './WhatsNewModal.interface';

const releases = [
  'v1.4.0',
  'v1.4.1',
  'v1.4.2',
  'v1.4.3',
  'v1.4.4',
  'v1.4.5',
  'v1.4.6',
  'v1.4.7',
  'v1.4.8',
  'v1.5.0',
  'v1.5.2',
  'v1.5.3',
  'v1.5.4',
  'v1.5.5',
  'v1.5.6',
  'v1.5.7',
  'v1.5.8',
  'v1.5.9',
  'v1.5.10',
  'v1.5.11',
  'v1.5.12',
  'v1.5.15',
  'v1.6.0',
  'v1.6.1',
  'v1.6.2',
  'v1.6.3',
  'v1.6.4',
  'v1.6.5',
  'v1.6.6',
  'v1.6.7',
  'v1.6.8',
  'v1.6.9',
  'v1.7.0',
  'v1.8.0',
].reverse();

export const WhatsNewModalV1 = ({
  visible,
  onCancel,
  header,
}: WhatsNewModalProps) => {
  const [selectedRelease, setSelectedRelease] = useState<string>(releases[0]);

  const [releaseManifest, setReleaseManifest] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [checkedValue, setCheckedValue] = useState<ToggleType>(
    ToggleType.FEATURES
  );

  useEffect(() => {
    const files = axios
      .get(
        'https://raw.githubusercontent.com/open-metadata/OpenMetadata/release-notes/release-1-8-0/manifest.json'
      )
      .then((response: { data: Record<string, unknown> }) => {
        setReleaseManifest(response.data);
      })
      .catch((error: AxiosError) => {
        // eslint-disable-next-line no-console
        console.error(error);
      });
  }, []);

  const handleToggleChange = (type: ToggleType) => {
    setCheckedValue(type);
  };

  return (
    <Modal
      centered
      bodyStyle={{
        padding: 0,
        paddingRight: 16,
      }}
      className="new-modal"
      footer={null}
      open={visible}
      title={header}
      width={912}
      onCancel={onCancel}>
      <div
        className="flex gap-4"
        style={{ maxHeight: 'inherit', overflow: 'hidden' }}>
        <Menu
          items={releases.map((release) => ({
            key: release,
            label: release,
          }))}
          selectedKeys={[selectedRelease]}
          style={{ flex: '0 0 120px', maxHeight: 'inherit', overflowY: 'auto' }}
          onSelect={(key) => {
            setSelectedRelease(key.key);
          }}
        />

        <div style={{ maxHeight: 'inherit', overflowY: 'auto' }}>
          <div className="p-t-md px-10 ">
            <div className="flex justify-between items-center p-b-sm gap-1">
              <div>
                <p className="text-base font-medium">
                  {releaseManifest?.name as string}
                </p>
                {releaseManifest?.releaseDate && (
                  <p className="m-t-xs font-medium">
                    {releaseManifest.releaseDate as string}
                  </p>
                )}
              </div>
              <div>
                {releaseManifest?.features?.length > 0 && (
                  <div className="whats-new-modal-button-container">
                    <Button.Group>
                      <Button
                        data-testid="WhatsNewModalFeatures"
                        ghost={checkedValue !== ToggleType.FEATURES}
                        type="primary"
                        onClick={() => handleToggleChange(ToggleType.FEATURES)}>
                        Features
                      </Button>

                      <Button
                        data-testid="WhatsNewModalChangeLogs"
                        ghost={checkedValue !== ToggleType.CHANGE_LOG}
                        type="primary"
                        onClick={() => {
                          handleToggleChange(ToggleType.CHANGE_LOG);
                        }}>
                        Change Logs
                      </Button>
                    </Button.Group>
                  </div>
                )}
              </div>
            </div>
            <div style={{ height: '500px' }}>
              {checkedValue === ToggleType.FEATURES &&
                (releaseManifest?.features as Array<string>)?.length > 0 && (
                  <div className="feature-carousal-container">
                    <Carousel autoplay>
                      {(releaseManifest?.features as Array<string>).map(
                        (features: string) => (
                          <DynamicMarkDownRenderer
                            filePath={features}
                            key={features}
                          />
                        )
                      )}
                    </Carousel>
                  </div>
                )}
              {checkedValue === ToggleType.CHANGE_LOG && (
                <DynamicMarkDownRenderer
                  filePath={releaseManifest?.changelog as string}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

const DynamicMarkDownRenderer = ({ filePath }: { filePath: string }) => {
  const [features, setFeatures] = useState<string>('');

  useEffect(() => {
    axios
      .get(filePath)
      .then((response: { data: string }) => {
        setFeatures(response.data);
      })
      .catch((error: AxiosError) => {
        // eslint-disable-next-line no-console
        console.error(error);
      });
  }, []);

  return <BlockEditor autoFocus={false} content={features} editable={false} />;
};
