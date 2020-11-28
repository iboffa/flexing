import { Component, OnInit, Input, ElementRef, HostListener, ViewEncapsulation, Output } from '@angular/core';
import { WidgetConfig, LayoutConfig } from './interfaces/configuration';
import { FlexingLayoutService } from './flexing-layout.service';
import { Subject } from 'rxjs';

@Component({
  selector: 'flexing-layout',
  template: ``,
  styleUrls: ['./style/flexing-layout.style.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class FlexingLayoutComponent implements OnInit {
  @Input() components: Array<WidgetConfig>;
  @Input() name: string;
  @Input() config: LayoutConfig;
  @Output() layoutRefresh = new Subject();

  constructor(private gls: FlexingLayoutService, public el: ElementRef) {}

  ngOnInit() {
    if (this.name === null || this.name === undefined) {
      throw new Error('/"name/" attribute is required');
    } else if (this.components === null || this.components === undefined) {
      throw new Error('Layout components are not defined for flexing-layout component /"' + this.name + '/"');
    } else {
      this.gls.createLayout(this);
    }
  }

  public refresh() {
    this.layoutRefresh.next();
  }

  public getRefreshSub() {
    return this.layoutRefresh.asObservable();
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.gls.getLayout(this.name).updateSize();
  }
}
