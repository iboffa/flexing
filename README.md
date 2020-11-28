# Flexing

Based on [Golden Layout](https://golden-layout.com/), Glayout allows to use Angular component inside Golden Layout structure

##Installation

Run the command

`npm run flexing`


Import the Glayout in the main module:
`import { FlexingModule } from "flexing"`;

In main module declaration, make sure to insert the Angular Components that would be hosted by the layout inside the `entryComponents` array.

## Using Flexing

### Layout components definition

Example:

```
<flexing-layout name="layout-name" [components]="components"></flexing-layout>
```

`name` is needed as an id for the Glayout component

`components` is an array of `WidgetConfig` element (see next paragraph)

### Component Definition

Glayout component has to be provided with an array of `WidgetConfig` in its input attribute `components`

Here it is an example of `WidgetConfig` element:

```
    {
         componentName: "ExampleComponent", //unique identifier of the component
         component: ExampleComponent, // the Angular Component to be hosted
         title: "Example", //the default tab title
         icon: "fa fa-circle", // the component icon that can be used in the component selector menu (see relative section)
         listeners: [
             {
               event: "eventName",
               callback(data) {
                   this.getInstance().text = data;
               }
             }
           ], //an array of listeners for events emitted from other components
         tabActions: [
            {
              label: "Link...",
              icon: "fa fa-link",
              action: (widgetApi) => {
                  widgetApi.link();
              }
            }
         ], //the array of actions that will be represented as buttons in the tab
         menuActions: [
            {
              label: "Change name",
              icon: "fa fa-pencil",
              action: (widgetApi) => {
                  widgetApi.setTitle("Menu Title");
              }
            },
         ] //the array of actions that will be represented in the tab dropdown menu
    }

```


#### Actions

Every action has to implement the `ActionItem` interface

    interface ActionItem {
      label: string; //The displayed name of the action
      icon?: string; // The displayed icon of the action
      iconColor?: string; //The color of the icon. If not defined, it is the same of the text(see Theming section)
      action: (widgetApi: WidgetApi)=>void; //the function executed on action click
    }

#### Listeners

Listeners have to implement `Listener` interface

    interface Listener {
      event: string;
      callback: Function;
    }

#### Component API

The Component API contains methods to operate on a generic component:

    setTitle(title: string) //sets a new title for the component tab
    getTitle() //returns current component tab title
    link() //starts linking process for current component (see "Linking Components" paragraph)
    unlink() //detaches current component from its source (see "Linking Components" paragraph)
    getInstance() //returns the component instance
    setTabActions(actions: Array<ActionItem>) //sets Tab Actions
    setMenuActions(actions: Array<ActionItem>) //sets Menu Actions

### Layout API

The Layout API contains methods to operate on layouts defined in the application.

To use Layout API, import `FlexingLayoutApi` in the component who will use it:

`import { FlexingLayoutApi } from "flexing"`

These are the available calls for Layout API:

    getLayoutState(name: string) //returns the object representing the specified layout state
    setLayoutState(layout: string, layoutConfig: GoldenLayout.Config) //sets the layout configuration for the specified layout
    getRegisteredComponents(layout: string) //returns the available layout components for the specified layout

### Components Menu Definition

To retrieve the `components` array for a certain layout:

import `FlexingLayoutApi` in the component hosting the menu:

`import { FlexingLayoutApi } from "flexing"`

call `getRegisteredComponents` method providing the layout name:

    export class MenuComponent{
        menuComponents:Array<WidgetConfig>
        constructor(private glApi: FlexingLayoutApi) {
            ...
            this.menuComponents=glApi.getRegisteredComponents(layoutName);
            ...
        }
    }

In the HTML definition of `MenuComponent`, use `flexing-element` directive to define draggable elements. When the element representing the component will be dragged on the layout, a new layout component will be created

    <div *ngFor="let c of components" flexing-element layout="layout" [component]="c">
        <i [class]=c.icon></i>
        <span>{{ c.title }}</span>
    </div>

### Linking components

Glayout allows to link different components with an event-based system.
In order to link two components, there has to be a match between the events emitted by the "source" (defined through `@Output` decorator in the Angular component) and the `listeners` array defined in the layout component definition: if the listening component has at least a listener that matches an event emitted by the source, the link can be created.

To link a component to a source, a "link" action has to be defined in the `tabAction` or in the `menuAction` of the component.

Example:

    {
        label: "Link...",
        icon: "fa fa-link",
        action: (widgetApi) => {
          widgetApi.link();
        }
      }

During runtime, the possible sources for the selected component will be highlighted. The link is created by linking on the source component.

The relationship will be signaled in the components tab: the source will have a full circle icon on the left of the tab title, the listener will have a full ring of the same color.

To remove a link, an "unlink" action has to be defined in the listening component.

Example:

    {
        label: "Unlink",
        icon: "fa fa-cancel",
        action: (widgetApi) {
          widgetApi.unlink();
        }
      }

### Theming

It is possible to customize the default theme overriding the SASS variables

| Variable                    | Scope                                             |
| --------------------------- | ------------------------------------------------- |
| \$font-family               | font family                                       |
| \$font-size                 | font size                                         |
| \$active-title              | Color of active tab title                         |
| \$menu-item-color           | Color of text in the action menu                  |
| \$core-bg-color             | Color of flexing-layout background                |
| \$splitter-color            | Color of the splitter between components on hover |
| \$overlay-panel-color       | Highlighting color of components while linking    |
| \$overlay-panel-color-hover | Highlighting color of components on hover         |
