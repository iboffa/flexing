import { Container, ActionItem, WidgetConfig } from '../interfaces/configuration';
import { FlexingLayoutService } from '../flexing-layout.service';
import { EventBusService } from '../api/event-bus.service';
import { Subscription, Subject, Observable } from 'rxjs';
import {
  ComponentRef,
  ComponentFactoryResolver,
  Injector,
  ApplicationRef,
  Renderer2,
  Input,
  DoCheck,
  KeyValueDiffers,
  } from '@angular/core';
import { WidgetApi } from './widget-api';

export class Widget implements DoCheck {
  private eventListeners: Map<string, Function> = new Map<string, (data: any) => void | boolean>();
  // private subscriptions: Subscription[] = [];
  private subscribers: Widget[] = [];
  private source: Widget = null;
  // private emitters: string[] = [];
  private tabActions: ActionItem[] = [];
  private menuActions: ActionItem[] = [];
  private tabActionListeners: Array<() => void> = [];
  private factory: any;
  public instanceId: string;
  readonly api: WidgetApi;
  private component: ComponentRef<any>;
  private actionMenuEl: HTMLElement;
  private menuActionsListeners: Array<() => void> = [];
  @Input() dynamicEmitters: Map<string, Subject<any>> = new Map<string, Subject<any>>();
  private differ: any;
  private listeners: Map<string, Function> = new Map<string, Function>();

  resizeObservable: Observable<Event>;
  resizeSubscription: Subscription;

  constructor(
    readonly def: WidgetConfig,
    readonly appRef: ApplicationRef,
    readonly containerRef: Container,
    readonly layoutRef: string,
    readonly FlexingLayoutServiceRef: FlexingLayoutService,
    readonly eventBusServiceRef: EventBusService,
    readonly componentFactoryResolver: ComponentFactoryResolver,
    readonly rd: Renderer2,
    readonly kvDiff: KeyValueDiffers
  ) {
    this.factory = componentFactoryResolver.resolveComponentFactory(this.def.component);
    this.component = this.createInstance();
    this.instanceId = containerRef.parent.config.id.toString();
    this.api = new WidgetApi(this);

    if (def.onInit) {
      def.onInit(this.api);
    }

    if (def.state !== undefined) {
      this.setState(def.state);
    }
    if (def.tabActions !== undefined) {
      this.tabActions = def.tabActions;
    }
    if (def.menuActions !== undefined) {
      this.menuActions = def.menuActions;
      this.setMenuActions(this.menuActions);
    }
    if (def.listeners) {
      const eventNames = Object.keys(def.listeners);
      eventNames.forEach((event) => this.eventListeners.set(event, def.listeners[event]));
    }

    this.eventBusServiceRef.registerComponent(this.instanceId, this.component.instance, this.def.component);
    if (def.getDynamicEmitters) {
      const emitters = def.getDynamicEmitters(this.api);
      Object.keys(emitters).forEach((event) => this.addEventEmitter(event, emitters[event]));
    }
    this.dynamicEmitters.forEach((subj, event) =>
      this.eventBusServiceRef.registerEvent(event, this.component.instance, this.instanceId, event, subj)
    );
    this.differ = this.kvDiff.find(this.dynamicEmitters).create();
    if (def.selfListeners) {
      const eventNames = Object.keys(def.selfListeners);
      eventNames.forEach((event) => {
        this.eventListeners.set(event, def.selfListeners[event]);
        this.eventBusServiceRef.subscribe(event, this.instanceId, this.instanceId);
      });
    }
  }

  ngDoCheck(): void {
    let dynamicEventChanges = this.differ.diff(this.dynamicEmitters);
    if (dynamicEventChanges) {
      dynamicEventChanges.forEachAddedItem((subj, event) =>
        this.eventBusServiceRef.registerEvent(event, this.component.instance, this.instanceId, subj)
      );
    }
  }

  public addEventEmitter(event: string, subject: Subject<any>) {
    this.dynamicEmitters.set(event, subject);
  }

  private createInstance() {
    const injector = Injector.create({ providers: [] });
    const component = this.factory.create(injector);
    this.appRef.attachView(component.hostView);
    return component;
  }

  public getInstance() {
    return this.component.instance;
  }

  public getView() {
    return (this.component.hostView as any).rootNodes[0] as HTMLElement;
  }

  public getContainerRef() {
    return this.containerRef;
  }

  public setSource(source: Widget) {
    this.source = source;
  }

  public getSource() {
    return this.source;
  }

  public onResize() {
    if (this.def.onResize) {
      // const _onResize = this.def.onResize.bind(this);
      this.def.onResize(this.api);
    }
  }

  getState() {
    if (this.def.getState) {
      return this.def.getState(this.api);
    }
    return {};
  }

  setState(state: any) {
    if (this.def.setState !== undefined) {
      this.def.setState(state, this.api);
    } else
      Object.keys(state).forEach((key) => {
        this.component.instance[key] = state[key];
      });
  }

  public equals(obj: any) {
    if (obj instanceof Widget) {
      if ((obj as Widget).instanceId === this.instanceId) {
        return true;
      }
    }
    return false;
  }

  public on(eventName: string, callback: (data: any, context?: WidgetApi) => void) {
    this.eventBusServiceRef.setCallback(this.instanceId, eventName, (data) => callback(data, this.api));
  }

  public subscribe(eventName: string, source: Widget) {
    this.eventBusServiceRef.subscribe(eventName, this.instanceId, source.instanceId);
  }

  public unsubscribeAll() {
    this.eventBusServiceRef.unsubscribeAll(this.instanceId);
  }

  public canListen(source: Widget): boolean {
    return this.getMatchingEvents(source).length > 0;
  }

  public getMatchingEvents(source: Widget): Array<string> {
    return this.getListeners().filter((value) => source.getEmitters().includes(value));
  }

  public getListeners(): Array<string> {
    return Array.from(this.eventListeners.keys());
  }

  public getEmitters(): Array<string> {
    return Array.from(this.eventBusServiceRef.getEvents(this.instanceId));
  }

  public addSubscriber(subscriber: Widget) {
    this.subscribers.push(subscriber);
  }

  public removeSubscriber(subscriber: Widget) {
    const subscriberIndex = this.subscribers.findIndex((component) => component.equals(subscriber));
    this.subscribers.splice(subscriberIndex, 1);
  }

  public getSubscribers() {
    return this.subscribers;
  }

  setTabActions(actions: ActionItem[]) {
    this.tabActionListeners.forEach((hook) => hook());
    this.tabActions = actions;
    this.tabActionListeners = this.FlexingLayoutServiceRef.setTabActions(this, actions);
  }

  getTabActions() {
    return this.tabActions;
  }

  private createActionMenu(
    component: Widget,
    actions: Array<ActionItem>
  ): { listeners: (() => void)[]; menuDiv: HTMLElement } {
    const listeners: Array<() => void> = [];
    const menuDiv: HTMLElement = this.rd.createElement('div');
    this.rd.setAttribute(menuDiv, 'class', 'gl_menu_actions');
    actions.forEach((item) => {
      const actionBtn = this.rd.createElement('div');
      this.rd.setAttribute(actionBtn, 'class', 'gl_menu_item');
      const actionIcon = this.rd.createElement('i');
      this.rd.setAttribute(actionIcon, 'class', item.icon);
      this.rd.setAttribute(actionIcon, 'title', item.icon);
      this.rd.appendChild(actionBtn, actionIcon);
      const label = this.rd.createText(item.label);
      this.rd.appendChild(actionBtn, label);
      // const _action = item.action.bind(component);
      listeners.push(this.rd.listen(actionBtn, 'click', () => item.action(this.api)));
      this.rd.appendChild(menuDiv, actionBtn);
    });
    const menuHook = this.rd.listen(window, 'mousedown', (event) => {
      if (!menuDiv.contains(event.target)) this.rd.removeChild(menuDiv.parentElement, menuDiv);
    });
    listeners.push(menuHook);
    return { listeners, menuDiv };
  }

  setMenuActions(actions: ActionItem[]) {
    this.menuActionsListeners.forEach((hook) => hook());
    this.menuActions = actions;
    const actionMenuObj = this.createActionMenu(this, actions);
    this.menuActionsListeners = actionMenuObj.listeners;
    this.actionMenuEl = actionMenuObj.menuDiv;
  }

  getActionMenuEl() {
    return this.actionMenuEl;
  }

  getMenuActions() {
    return this.menuActions;
  }

  destroy() {
    this.eventBusServiceRef.unregisterComponent(this.instanceId);
    if (this.tabActionListeners) this.tabActionListeners.forEach((hook) => hook());
    if (this.menuActionsListeners) this.menuActionsListeners.forEach((hook) => hook());
    this.appRef.detachView(this.component.hostView);
    this.component.destroy();
  }
}
