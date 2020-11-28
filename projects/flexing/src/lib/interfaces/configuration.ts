import * as GoldenLayout from 'golden-layout';
import { Subject } from 'rxjs';
import { WidgetApi } from '../classes/widget-api';

type basic = string | number | boolean;
type composed = basic[] | { [x: string]: basic };

type serializable = basic | composed | [basic | composed] | { [x: string]: basic | composed };

type serializableObject = { [x: string]: serializable };

export interface WidgetConfig extends GoldenLayout.ComponentConfig {
  onResize?: (api?: WidgetApi) => void;
  onInit?: (api?: WidgetApi) => void;
  getState?: (api?: WidgetApi) => serializableObject;
  setState?: (state: serializableObject, api?: WidgetApi) => void;
  component: any;
  state?: any;
  icon?: string;
  tabActions?: Array<ActionItem>;
  menuActions?: Array<ActionItem>;
  getDynamicEmitters?: (
    api?: WidgetApi,
    ...args: any
  ) => {
    [x: string]: Subject<any>;
  };
  listeners?: { [x: string]: (data: any, widgetApi?: WidgetApi) => any };
  selfListeners?: { [x: string]: (data: any, widgetApi?: WidgetApi) => any };
  instanceId?: string;
  windowParams?: { width: number; height: number; left: number; top: number };
  [x: string]: any;
}

export interface LayoutConfig extends GoldenLayout.Config {
  componentState?: serializableObject;
  links?: Link[];
  icons?: {
    source?: string;
    listener?: string;
  };
}

export interface Link {
  source: string;
  subscribers?: string[];
  color: string;
}

export interface Container extends GoldenLayout.Container {
  instanceId: string;
}

export interface ActionItem {
  label: string;
  icon?: string;
  iconColor?: string;
  action: (widgetApi?: WidgetApi, ...arg: any) => any;
}

export interface Listeners {
  [event: string]: (data: any, widgetApi?: WidgetApi) => any;
}

interface LayoutSettings {
  hasHeaders?: boolean;
  constrainDragToContainer?: boolean;
  reorderEnabled?: boolean;
  selectionEnabled?: boolean;
  popoutWholeStack?: boolean;
  blockedPopoutsThrowError?: boolean;
  closePopoutsOnUnload?: boolean;
  showPopoutIcon?: boolean;
  showMaximiseIcon?: boolean;
  showCloseIcon?: boolean;
  responsiveMode?: 'always' | 'none' | 'onload';
}

interface LayoutDimensions {
  headerHeight?: number;
  minItemWidth?: number;
  minItemHeight?: number;
  dragProxyWidth?: number;
  dragProxyHeight?: number;
}

interface LayoutLabels {
  close?: string;
  maximise?: string;
  minimise?: string;
  popout?: string;
  popin?: string;
  tabDropdown?: string;
}

interface LayoutType {
  type: 'stack' | 'column' | 'row';
}
