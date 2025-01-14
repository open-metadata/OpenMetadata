import { IPlugin, PluginStore } from "react-pluggable";
import SlackModal from "./components/SlackModal";
import React from "react";
import { ProductOutlined } from "@ant-design/icons";

class SlackPlugin implements IPlugin {
  namespace = "SlackPlugin";
  pluginStore!: PluginStore;

  constructor() {
    console.log("SlackPlugin instantiated");
  }

  getPluginName(): string {
    return `${this.namespace}@1.0.0`;
  }

  getDependencies(): string[] {
    return []; // No dependencies for this plugin
  }

  init(pluginStore: PluginStore): void {
    this.pluginStore = pluginStore;
  }

  activate(): void {
    // Add the modal button to the UI
    this.pluginStore.executeFunction(
      "Renderer.add",
      "EntityHeaderButtonGroup.button", // placement of the component
      () => <SlackModal />
    );
  }

  deactivate(): void {
    // Remove the modal button from the UI
    this.pluginStore.executeFunction(
      "Renderer.remove",
      "EntityHeaderButtonGroup.button",
      () => <SlackModal />
    );
  }
}

export default SlackPlugin;
