import { Directive, Input, ElementRef, AfterViewInit } from '@angular/core';
import { WidgetConfig } from '../interfaces/configuration';
import { FlexingLayoutService } from '../flexing-layout.service';

@Directive({
  selector: '[flexing-element]',
})
export class WidgetSourceDirective implements AfterViewInit {
  @Input() component: WidgetConfig;
  @Input() layout: string;

  constructor(readonly el: ElementRef, readonly gls: FlexingLayoutService) {}

  ngAfterViewInit() {
    if (this.component === undefined || this.component === null) {
      throw new Error('component value is null or undefined');
    }
    if (this.layout === undefined || this.layout === null) {
      throw new Error('Associated layout is null or undefined');
    } else {
      this.gls.createComponentMenuItem(this.el.nativeElement, this.component, this.layout);
    }
    this.gls.layoutComponentRef
      .get(this.layout)
      .getRefreshSub()
      .subscribe(() => this.gls.createComponentMenuItem(this.el.nativeElement, this.component, this.layout));
  }
}
