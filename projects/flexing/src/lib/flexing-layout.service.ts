import {
  Injectable,
  ComponentRef,
  NgZone,
  ComponentFactoryResolver,
  ApplicationRef,
  Renderer2,
  RendererFactory2,
  KeyValueDiffers,
} from '@angular/core';
import { hsl, deltaE, Color } from 'chroma.ts';
import * as GoldenLayout from 'golden-layout';
import { WidgetConfig, LayoutConfig, Container, ActionItem, Link } from './interfaces/configuration';
import { Widget } from './classes/widget';
import { EventBusService } from './api/event-bus.service';
import { FlexingLayoutComponent } from './flexing-layout.component';

// type NgComponent<T> = new (...params: any[]) => T;

@Injectable({
  providedIn: 'root',
})
export class FlexingLayoutService {
  private _layoutMap: Map<string, GoldenLayout> = new Map<string, GoldenLayout>();
  private _registeredComponents: Map<string, Array<WidgetConfig>> = new Map<string, Array<WidgetConfig>>();
  private _liveComponents: Map<string, Map<string, Widget>> = new Map<string, Map<string, Widget>>();
  private _currentLinkingComponents: Map<string, Widget> = new Map<string, Widget>();
  private _linkColors: Map<string, Map<string, string>> = new Map<string, Map<string, string>>();
  private _layoutContainers: Map<string, HTMLElement> = new Map<string, HTMLElement>();
  public layoutComponentRef: Map<string, FlexingLayoutComponent> = new Map<string, FlexingLayoutComponent>();
  private rd: Renderer2;
  private cancelLinkingHook: () => void;

  private defaultConfig = {
    settings: {
      hasHeaders: true,
      constrainDragToContainer: true,
      reorderEnabled: true,
      selectionEnabled: false,
      popoutWholeStack: false,
      blockedPopoutsThrowError: true,
      closePopoutsOnUnload: true,
      showPopoutIcon: false,
      showMaximiseIcon: false,
      showCloseIcon: false,
      responsiveMode: 'always',
    },
    dimensions: {
      headerHeight: 20,
      minItemWidth: 200,
      minItemHeight: 200,
      dragProxyWidth: 0,
      dragProxyHeight: 0,
    },
    labels: {
      close: 'close',
      maximise: 'maximise',
      minimise: 'minimise',
      popout: 'open in new window',
      popin: 'pop in',
      tabDropdown: 'Additional tabs',
    },
    content: [
      {
        type: 'stack',
      },
    ],
  } as LayoutConfig;

  constructor(
    private zone: NgZone,
    private cfResolver: ComponentFactoryResolver,
    private appRef: ApplicationRef,
    readonly rendererFactory: RendererFactory2,
    private eventBus: EventBusService,
    private kvDiffers: KeyValueDiffers
  ) {
    this.rd = rendererFactory.createRenderer(null, null);
  }

  createLayout(gLayout: FlexingLayoutComponent) {
    let refresh = false;
    const container = gLayout.el.nativeElement;
    if (gLayout.config === undefined) {
      gLayout.config = this.defaultConfig;
    }
    if (this._layoutMap.has(gLayout.name)) {
      this.removeLayout(gLayout.name);
      refresh = true;
    }
    this._layoutMap.set(gLayout.name, new GoldenLayout(gLayout.config, container));
    this._registeredComponents.set(gLayout.name, gLayout.components);
    this._linkColors.set(gLayout.name, new Map<string, string>());
    this._liveComponents.set(gLayout.name, new Map<string, Widget>());
    this._layoutContainers.set(gLayout.name, container);
    this.layoutComponentRef.set(gLayout.name, gLayout);
    gLayout.components.forEach((component) => {
      this.registerWidget(component, gLayout.name, gLayout.config);
    });
    const layout = this._layoutMap.get(gLayout.name);
    const self = this;
    layout.on('stackCreated', function (stack) {
      /*
       * Listening for activeContentItemChanged. This happens initially
       * when the stack is created and everytime the user clicks a tab
       */

      stack.on('activeContentItemChanged', function (contentItem) {
        // interact with the contentItem
        const c = contentItem;
        // initially when tab is added to layout
        self.zone.run(() => {
          const lcHost = c.container.parent.element[0];
          const linkOverlay = lcHost.querySelector('.gl_link_overlay');
          if (linkOverlay !== null) {
            self.rd.setStyle(linkOverlay, 'top', lcHost.offsetTop + 'px');
          }
          layout.updateSize(container.clientWidth, container.clientHeight);
        });
      });
    });
    layout.init();
    if (gLayout.config.links && gLayout.config.links.length > 0) {
      gLayout.config.links.forEach((link) => {
        const source = this._liveComponents.get(gLayout.name).get(link.source);
        this._linkColors.get(gLayout.name).set(link.source, link.color);
        link.subscribers.forEach((sub) => {
          this.finalizeLinking(gLayout.name, source, this._liveComponents.get(gLayout.name).get(sub));
        });
      });
    }
    if (refresh) this.layoutComponentRef.get(gLayout.name).refresh();
  }

  public getLayout(name: string): GoldenLayout {
    return this._layoutMap.get(name);
  }

  public removeLayout(name: string) {
    this._registeredComponents.delete(name);
    this._linkColors.delete(name);
    this._liveComponents.get(name).forEach((comp) => comp.destroy());
    this._liveComponents.delete(name);
    this._layoutContainers.delete(name);
    this._currentLinkingComponents.delete(name);
    this._layoutMap.get(name).destroy();
    this._layoutMap.delete(name);
  }

  public getLayoutContainer(name: string): HTMLElement {
    return this._layoutContainers.get(name);
  }

  public getLayoutState(name: string) {
    const componentState = {};
    this._liveComponents.get(name).forEach((comp) => {
      componentState[comp.instanceId] = comp.getState();
    });
    const state = this.getLayout(name).toConfig();
    state.componentState = componentState;
    state.links = this.getLinks(name);
    return state;
  }

  public popout(layoutComponent: Widget, layout: string) {
    this.getLayout(layout).createPopout(
      layoutComponent.def,
      layoutComponent.def.windowParams,
      layoutComponent.containerRef.parent.id
    );
  }

  public createComponentMenuItem(element: HTMLElement, component: WidgetConfig, layout: string) {
    component.type = 'component';
    this.getLayout(layout).createDragSource(element, component);
  }

  private registerWidget(layoutComponent: WidgetConfig, layout: string, config: LayoutConfig) {
    layoutComponent.component = <ComponentRef<any>>layoutComponent.component;
    const _layout = this.getLayout(layout);
    const self = this;
    let componentWrapper: Widget;
    _layout.registerComponent(layoutComponent.componentName, function (container: Container) {
      self.zone.run((_) => {
        if (!container.parent.config.id) {
          const iid = self.generateInstanceId();
          container.parent.addId(iid);
        }
        componentWrapper = new Widget(
          layoutComponent,
          self.appRef,
          container,
          layout,
          self,
          self.eventBus,
          self.cfResolver,
          self.rd,
          self.kvDiffers
        );

        const view = componentWrapper.getView();
        self.rd.appendChild(container.getElement().get(0), view);
        self._liveComponents.get(layout).set(container.parent.config.id.toString(), componentWrapper);
      });
      container.on('destroy', () => {
        if (self._liveComponents.has(layout)) {
          const el = self._liveComponents.get(layout).get(container.parent.config.id.toString());
          self.zone.run((_) => {
            if (el) {
              el.unsubscribeAll();
              if (el.getSource() !== undefined && el.getSource() !== null) {
                el.getSource().removeSubscriber(el);
              }

              if (self._linkColors.get(layout).has(el.instanceId)) {
                self._linkColors.get(layout).delete(el.instanceId);
                el.getSubscribers().forEach((sub) => {
                  self.removeLinkListenerIcon(sub);
                  sub.unsubscribeAll();
                  sub.setSource(null);
                });
              }
              self._liveComponents.get(layout).delete(container.parent.config.id.toString());
              el.destroy();
            }
          });
        }
      });

      // tslint:disable-next-line: only-arrow-functions
      container.on('resize', function () {
        self.zone.run(() => {
          (componentWrapper.api.getInstance() as any).width = container.width;
          (componentWrapper.api.getInstance() as any).height = container.height;
          const lcHost = container.parent.element[0];
          const linkOverlay = lcHost.querySelector('.gl_link_overlay');
          if (linkOverlay !== null) {
            self.rd.setStyle(linkOverlay, 'top', lcHost.offsetTop + 'px');
          }
          // if (typeof (componentWrapper.getInstance() as any).glOnResize === 'function') {
          //   ((componentWrapper.getInstance() as any) as glOnResize).glOnResize(container);
          // }
          self._liveComponents.get(layout).forEach((comp) => comp.onResize());
          _layout.updateSize();
        });
      });

      // tslint:disable-next-line: only-arrow-functions
      container.on('open', function () {
        const el = self._liveComponents.get(layout).get(container.parent.config.id.toString());
        if (config.componentState && config.componentState[container.parent.config.id.toString()]) {
          el.setState(config.componentState[container.parent.config.id.toString()]);
        }
        if (layoutComponent.listeners) {
          Object.keys(layoutComponent.listeners).forEach((event) => {
            el.on(event, layoutComponent.listeners[event]);
          });
        }
        if (layoutComponent.selfListeners) {
          Object.keys(layoutComponent.listeners).forEach((event) => {
            el.on(event, layoutComponent.selfListeners[event]);
          });
        }
      });

      // tslint:disable-next-line: only-arrow-functions
      container.on('hide', function () {});

      // tslint:disable-next-line: only-arrow-functions
      container.on('show', function () {});

      container.on('tab', function (tab) {
        const currentLinking = self._currentLinkingComponents.get(layout);
        if (currentLinking !== null && currentLinking !== undefined) {
          self.startLinking(layout, currentLinking);
        }
        setTimeout(() => {
          const comp = self._liveComponents.get(layout).get(container.parent.config.id.toString());
          // (comp => {
          self.cleanTab(comp);
          self.restoreTab(comp, layout);
          self._liveComponents.get(layout).forEach((comp) => comp.onResize());
          // });
        });
      });
    });
  }

  public startLinking(layout: string, component: Widget) {
    this._currentLinkingComponents.set(layout, component);
    this.removeLinkOverlays(layout);
    if (!(component.getSubscribers.length > 0))
      this._liveComponents.get(layout).forEach((c) => {
        if (
          !component.equals(c) &&
          component.canListen(c) &&
          !(c.getSource() !== null)
        ) {
          this.createLinkOverlay(layout, c, component);
        }
      });
  }

  public getLinks(layout: string): Link[] {
    const links: Link[] = [];
    this._liveComponents.get(layout).forEach((component) => {
      const subs = component.getSubscribers();
      if (subs.length > 0) {
        const subIds = [];
        subs.forEach((sub) => {
          subIds.push(sub.instanceId);
        });
        const link: Link = {
          source: component.instanceId,
          color: this._linkColors.get(layout).get(component.instanceId),
          subscribers: subIds,
        };
        links.push(link);
      }
    });
    return links;
  }

  private createLinkOverlay(layout: string, target: Widget, listener: Widget) {
    const lcHost = target.getContainerRef().parent.element[0];
    const linkOverlay = this.rd.createElement('div');
    this.rd.setAttribute(linkOverlay, 'class', 'gl_link_overlay');
    this.rd.setStyle(linkOverlay, 'top', lcHost.offsetTop + 'px');
    this.rd.setStyle(linkOverlay, 'left', 'inherit');
    this.rd.setStyle(linkOverlay, 'width', 'inherit');
    this.rd.setStyle(linkOverlay, 'height', 'inherit');
    this.rd.listen(linkOverlay, 'click', () => {
      this.finalizeLinking(layout, target, listener);
    });
    this.cancelLinkingHook = this.rd.listen(document, 'keydown', (event) => {
      if (event.key === 'Escape') {
        this.cancelLinking(layout);
      }
    });
    this.rd.appendChild(lcHost, linkOverlay);
  }

  public unlink(listener: Widget) {
    this.removeLinkListenerIcon(listener);
    listener.unsubscribeAll();
    listener.getSource().removeSubscriber(listener);
  }

  private finalizeLinking(layout: string, target: Widget, listener: Widget) {
    if (listener.getSource() !== undefined && listener.getSource() !== null) {
      this.unlink(listener);
    }
    listener.getMatchingEvents(target).forEach((event) => {
      listener.subscribe(event, target);
    });
    listener.setSource(target);
    target.addSubscriber(listener);
    this.removeLinkOverlays(layout);
    this._currentLinkingComponents.set(layout, null);
    if (!this._linkColors.get(layout).has(target.instanceId)) {
      this.setLinkSourceIcon(target, layout);
    }
    this.setLinkListenerIcon(listener, layout, target.instanceId);
    this.zone.run(() => {});
  }

  private cancelLinking(layout: string) {
    this.removeLinkOverlays(layout);
    this._currentLinkingComponents.set(layout, null);
    this.cancelLinkingHook();
  }

  private removeLinkOverlays(layout: string) {
    this._liveComponents.get(layout).forEach((c) => {
      const lcHost = c.getContainerRef().parent.element[0];
      const linkOverlay = lcHost.querySelector('.gl_link_overlay');
      if (linkOverlay !== null) {
        this.rd.removeChild(lcHost, linkOverlay);
      }
    });
  }

  private setLinkSourceIcon(component: Widget, layout: string, color?: string) {
    this.removeLinkSourceIcon(component);
    if (color === undefined) {
      color = this.createLinkColor(layout);
      this._linkColors.get(layout).set(component.instanceId, color);
    }
    const srcIcon = this.rd.createElement('i');
    this.rd.setAttribute(srcIcon, 'class', 'fa fa-circle gl_link_source');
    this.rd.setStyle(srcIcon, 'color', color);
    const tab = component.getContainerRef().tab;
    const lstIcon = tab.element[0].querySelector('.gl_link_listener');
    if (lstIcon) {
      this.rd.insertBefore(tab.element[0], srcIcon, lstIcon);
    } else this.rd.insertBefore(tab.element[0], srcIcon, tab.titleElement[0]);
  }

  private setLinkListenerIcon(component: Widget, layout: string, sourceId: string) {
    const color = this._linkColors.get(layout).get(sourceId);
    const lstIcon = this.rd.createElement('i');
    this.rd.setAttribute(lstIcon, 'class', 'fa fa-dot-circle-o gl_link_listener');
    this.rd.setStyle(lstIcon, 'color', color);
    const tab = component.getContainerRef().tab;
    this.rd.insertBefore(tab.element[0], lstIcon, tab.titleElement[0]);
  }

  private removeLinkListenerIcon(component: Widget) {
    const tab = component.getContainerRef().tab;
    const lstIcon = tab.element[0].querySelector('.gl_link_listener');
    if (lstIcon !== null && lstIcon !== undefined) this.rd.removeChild(tab.element[0], lstIcon);
  }

  private removeLinkSourceIcon(component: Widget) {
    const tab = component.getContainerRef().tab;
    const srcIcon = tab.element[0].querySelector('.gl_link_source');
    if (srcIcon !== null && srcIcon !== undefined) this.rd.removeChild(tab.element[0], srcIcon);
  }

  public setTabActions(component: Widget, actions: Array<ActionItem>): Array<() => void> {
    const tabActionsDiv = this.rd.createElement('div');
    const listeners: Array<() => void> = [];
    this.rd.setAttribute(tabActionsDiv, 'class', 'gl_tab_actions');
    actions.forEach((item) => {
      const actionBtn = this.rd.createElement('i');
      this.rd.setAttribute(actionBtn, 'title', item.label);
      this.rd.setAttribute(actionBtn, 'class', item.icon);
      // const _action = item.action.bind(component);
      if (item.iconColor) {
        this.rd.setStyle(actionBtn, 'color', item.iconColor);
      }
      listeners.push(this.rd.listen(actionBtn, 'click', () => item.action(component.api)));
      this.rd.appendChild(tabActionsDiv, actionBtn);
    });
    if (component.getMenuActions().length > 0) {
      const actionBtn = this.rd.createElement('i');
      this.rd.setAttribute(actionBtn, 'class', 'fa fa-caret-down');
      const action = (event: Event) => {
        const menuEl = component.getActionMenuEl();
        this.rd.setStyle(
          menuEl,
          'top',
          actionBtn.getBoundingClientRect().top + actionBtn.getBoundingClientRect().height + 'px'
        );
        this.rd.setStyle(menuEl, 'left', actionBtn.getBoundingClientRect().x + 'px');
        this.rd.appendChild(document.body, menuEl);
        event.stopImmediatePropagation();
      };
      listeners.push(this.rd.listen(actionBtn, 'click', action));
      this.rd.appendChild(tabActionsDiv, actionBtn);
    }
    const tab = component.getContainerRef().tab;
    const prevTabActionsDiv = tab.element[0].querySelector('.gl_tab_actions');
    if (prevTabActionsDiv !== null) {
      this.rd.removeChild(tab.element[0], prevTabActionsDiv);
    }
    this.rd.insertBefore(tab.element[0], tabActionsDiv, tab.closeElement[0]);
    return listeners;
  }
  private removeTabActions(component: Widget) {
    const tab = component.getContainerRef().tab;
    const prevTabActionsDiv = tab.element[0].querySelector('.gl_tab_actions');
    if (prevTabActionsDiv !== null) {
      this.rd.removeChild(tab.element[0], prevTabActionsDiv);
    }
  }

  private cleanTab(component: Widget) {
    this.removeLinkListenerIcon(component);
    this.removeLinkSourceIcon(component);
    this.removeTabActions(component);
  }

  private restoreTab(component: Widget, layout: string) {
    if (this._linkColors.get(layout).has(component.instanceId))
      this.setLinkSourceIcon(component, layout, this._linkColors.get(layout).get(component.instanceId));
    if (component.getSource() !== undefined && component.getSource() !== null)
      this.setLinkListenerIcon(component, layout, component.getSource().instanceId);
    this.setTabActions(component, component.getTabActions());
  }

  public getRegisteredComponents(layout: string) {
    return this._registeredComponents.get(layout);
  }

  private createLinkColor(layout: string) {
    let color: Color;
    let minDif;
    const colors = this._linkColors.get(layout);
    do {
      minDif = 101;
      color = hsl(Math.round(Math.random() * 360), 1, 0.65 + Math.random() * 0.35);
      colors.forEach((element) => {
        minDif = Math.min(deltaE(color, element), minDif);
      });
    } while (minDif < 100 / (colors.size + 1));

    return color.hex();
  }

  private generateInstanceId() {
    return Math.random().toString(36).substring(2, 15);
  }
}
