import React, { useState } from "react";
import { Button, Modal, Tooltip } from "antd";
import { SlackOutlined } from "@ant-design/icons";

const SlackModal = () => {
  const [isVisible, setIsVisible] = useState(false);
  const showModal = () => setIsVisible(true);
  const hideModal = () => setIsVisible(false);

  return (
    <>
      <Tooltip placement="topRight" title="Slack">
        <Button icon={<SlackOutlined />} onClick={showModal} />
      </Tooltip>
      <Modal
        title="Plugin Modal"
        open={isVisible}
        onOk={hideModal}
        onCancel={hideModal}
      >
        <p>This is a text message inside the modal from the plugin!</p>
      </Modal>
    </>
  );
};

export default SlackModal;
