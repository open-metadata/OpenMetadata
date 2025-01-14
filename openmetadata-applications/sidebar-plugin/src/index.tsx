import { ReactComponent as ExploreIcon } from "./assets/menu.svg";

import { PluginStore } from "react-pluggable";
import { RouteProps } from "react-router-dom";
import { BasePlugin } from "./basePlugin";
import DemoComponent from "./components/DemoComponent";

class SidebarPlugin implements BasePlugin {
  namespace = "SidebarPlugin";
  pluginStore!: PluginStore;

  constructor() {
    console.log("SidebarPlugin instantiated");
  }

  routes: RouteProps[] = [
    {
      path: "/sidebar-app",
      component: DemoComponent,
      exact: true,
    },
  ];

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
    this.pluginStore.addFunction("sidebarAdd", () => {
      return {
        key: "sidebar-app",
        title: "Sidebar App",
        redirect_url: "/sidebar-app",
        icon: ExploreIcon,
        dataTestId: `app-bar-item-sidebar-app`,
      };
    });
  }

  deactivate(): void {
    // Remove the modal button from the UI
    // this.pluginStore.executeFunction("Renderer.remove", "Sidebar.item", () => (
    //   <SlackModal />
    // ));
  }
}

export default SidebarPlugin;
