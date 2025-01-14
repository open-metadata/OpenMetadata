import { IPlugin } from "react-pluggable";
import { RouteProps } from "react-router";

interface BasePlugin extends IPlugin {
  routes: RouteProps[];
}

export { BasePlugin };
