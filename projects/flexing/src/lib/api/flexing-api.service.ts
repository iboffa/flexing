import { Injectable } from '@angular/core';
import { FlexingLayoutService } from '../flexing-layout.service';
import * as GoldenLayout from 'golden-layout';
import { WidgetConfig } from '../interfaces/configuration';

@Injectable({
  providedIn: 'root',
})
export class GLayoutApiService {
  // private glsInstance: FlexingLayoutService;

  constructor(readonly glsInstance: FlexingLayoutService) {}

  /**
   * Returns the state of a given layout
   * @param name layout name
   */
  public getLayoutState(name: string) {
    return { ...this.glsInstance.getLayoutState(name) };
  }

  /**
   * Sets state to the specified layout
   * @param layout layout name
   * @param layoutConfig configuration
   */

  public setLayoutState(layout: string, layoutConfig: GoldenLayout.Config) {
    this.glsInstance.layoutComponentRef.get(layout).config = layoutConfig;
    this.glsInstance.createLayout(this.glsInstance.layoutComponentRef.get(layout));
  }

  /**
   * Get registered components for layout
   * @param layout layout name
   */
  public getRegisteredComponents(layout: string): Array<WidgetConfig> {
    return this.glsInstance.getRegisteredComponents(layout);
  }
}
