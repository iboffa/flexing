import { NgModule } from '@angular/core';
import { FlexingLayoutComponent } from './flexing-layout.component';
import { WidgetSourceDirective } from './directives/component-src.directive';
import * as JQuery from 'jquery';

@NgModule({
  declarations: [FlexingLayoutComponent, WidgetSourceDirective],
  imports: [],
  exports: [FlexingLayoutComponent, WidgetSourceDirective],
})
export class FlexingModule {}
