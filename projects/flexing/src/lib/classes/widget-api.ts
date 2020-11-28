import { Widget } from './widget';
import { ActionItem } from '../interfaces/configuration';
import { Subject } from 'rxjs';

export class WidgetApi {
  constructor(readonly component: Widget) {}

  /**
   * Sets title to the widget tab
   * @param title
   */

  public setTitle(title: string) {
    this.component.containerRef.setTitle(title);
  }

  /**
   * Returns widget tab title
   */

  public getTitle(): string {
    return (this.component.containerRef as any)._config.title;
  }

  /**
   * Starts linking for the current widget
   */

  public link() {
    this.component.FlexingLayoutServiceRef.startLinking(this.component.layoutRef, this.component);
  }

  /**
   * Opens new browser window containing the current widget
   */

  public popout() {
    this.component.FlexingLayoutServiceRef.popout(this.component, this.component.layoutRef);
  }

  /**
   * Remove listeners from source widget
   */

  public unlink() {
    this.component.FlexingLayoutServiceRef.unlink(this.component);
  }

  /**
   * Returns the Angular Component instance of the element inside the widget
   */

  public getInstance(): any {
    return this.component.getInstance();
  }

  public addDynamicEvent(eventName: string, eventEmitter: Subject<any>) {
    this.component.dynamicEmitters.set(eventName, eventEmitter);
  }

  public setTabActions(actions: Array<ActionItem>) {
    this.component.setTabActions(actions);
  }

  public setMenuActions(actions: Array<ActionItem>) {
    this.component.setMenuActions(actions);
  }

  public getView() {
    return this.component.getView();
  }
}
