import { Injectable, Type, ComponentFactoryResolver } from '@angular/core';
import { ReplaySubject, Subscription, Subject } from 'rxjs';

type EventMap = Map<string, ReplaySubject<any>>;
type CallbackMap = Map<string, (data: any, context?: any) => void>;

@Injectable({
  providedIn: 'root',
})
export class EventBusService {
  private eventRelay: Map<string, EventMap> = new Map<string, EventMap>();
  private eventInterceptor: Map<string, Array<Subscription>> = new Map<string, Array<Subscription>>();
  private callbacks: Map<string, CallbackMap> = new Map<string, CallbackMap>();
  private subscriptions: Map<string, Map<string, Subscription>> = new Map<string, Map<string, Subscription>>();
  private channels: Map<string, Array<string>> = new Map<string, Array<string>>();
  private channelSubscriptions: Map<string, string> = new Map<string, string>();
  // private contexts: Map<string, any> = new Map<string, any>();

  constructor(readonly componentFactoryResolver: ComponentFactoryResolver) {}

  public registerComponent(id: string, componentInstance: any, componentType: Type<any>) {
    this.eventRelay.set(id, new Map<string, ReplaySubject<any>>());
    this.eventInterceptor.set(id, []);
    this.callbacks.set(id, new Map<string, (data: any, context?: any) => void>());
    this.subscriptions.set(id, new Map<string, Subscription>());
    const factory = this.componentFactoryResolver.resolveComponentFactory(componentType);
    const outputs = factory.outputs;
    // this.contexts.set(id, context);
    outputs.forEach((event) => this.registerEvent(event.templateName, componentInstance, id, event.propName));
  }

  public unregisterComponent(id: string) {
    if (this.eventInterceptor.has(id)) {
      this.eventInterceptor.get(id).forEach((sub) => sub.unsubscribe());
      this.eventInterceptor.delete(id);
      this.eventRelay.get(id).forEach((sub) => sub.unsubscribe());
      this.eventRelay.delete(id);
      // this.contexts.delete(id);
    }
  }

  public registerEvent(
    eventName: string,
    component: any,
    instanceId: string,
    eventProperty?: string,
    eventSubject?: Subject<any>
  ) {
    this.eventRelay.get(instanceId).set(eventName, new ReplaySubject<any>(1));
    if (!eventSubject) {
      eventSubject = component[eventProperty ? eventProperty : eventName] as Subject<any>;
    }
    this.eventInterceptor.get(instanceId).push(
      eventSubject.subscribe({
        next: (data) => this.emit(eventName, instanceId, data),
      })
    );
  }

  public getEvents(instanceId: string) {
    return this.eventRelay.get(instanceId).keys();
  }

  public emit(eventName: string, instanceId: string, data: any) {
    if (this.eventRelay.get(instanceId).has(eventName)) {
      this.eventRelay.get(instanceId).get(eventName).next(data);
    } else {
      throw new Error('Event has not been registered in component');
    }
  }

  public setCallback(instanceId: string, event: string, callback: (data: any) => void) {
    this.callbacks.get(instanceId).set(event, callback);
  }

  public getCallback(eventName: string, listenerId: string) {}

  public subscribe(eventName: string, listenerId: string, sourceId: string) {
    if (this.eventRelay.has(sourceId) && this.eventRelay.get(sourceId).has(eventName)) {
      const sub = this.eventRelay
        .get(sourceId)
        .get(eventName)
        .subscribe({
          next: (data) => this.callbacks.get(listenerId).get(eventName)(data),
        });
      this.subscriptions.get(listenerId).set(eventName, sub);
    }
  }

  public subscribeAll(listenerId: string, sourceId: string) {
    Array.from(this.getEvents(sourceId)).forEach((event) => this.subscribe(event, listenerId, sourceId));
  }

  public unsubscribe(listenerId: string, eventName: string) {
    const allSubs = this.subscriptions.get(listenerId);
    const sub = allSubs.get(eventName);
    sub.unsubscribe();
    allSubs.delete(eventName);
  }

  public unsubscribeAll(listenerId: string) {
    const allSubs = this.subscriptions.get(listenerId);
    allSubs.forEach((sub, event) => {
      sub.unsubscribe();
    });
    allSubs.clear();
  }

  public joinChannel(channelId: string, instanceId: string) {
    this.channels.get(channelId).forEach((member) => {
      this.subscribeAll(member, instanceId);
      this.subscribeAll(instanceId, member);
    });
    this.channels.get(channelId).push(instanceId);
    this.channelSubscriptions.set(instanceId, channelId);
  }

  // public leaveChannel(instanceId:string){
  //   const channelId = this.channelSubscriptions.get(instanceId);
  //   this.channels.get(channelId).forEach(member =>{
  //     this.unsubscribeAll(instanceId);
  //     this.subscribeAll(instanceId, member);
  //   });
  //   this.channels.get(channelId).push(instanceId);
  //   this.channelSubscriptions.set(instanceId, channelId);
  // }
}
