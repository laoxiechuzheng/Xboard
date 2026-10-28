import{$t as e,Cn as t,Hn as n,L as r,Ln as i,M as a,Mn as o,P as s,Pn as c,R as l,Rn as u,Un as d,Xt as f,Yn as p,Zt as m,bn as h,bt as g,ct as _,en as v,hn as y,ht as b,jn as x,kn as S,nn as C,nr as w,or as T,rr as E,sn as D,st as O,tn as k,tr as A,ut as j,vt as M,xn as N,yn as P}from"./light-C36WBRZZ.js";import{n as F,s as ee}from"./_plugin-vue_export-helper-Y2v3pMRv.js";import{$ as I,At as L,Ct as R,Dt as z,Et as B,I as te,Ot as V,Z as ne,kt as re,st as ie,yt as ae}from"./discrete-BMBIarA6.js";import{C as H,c as oe,f as se,g as ce,h as le,l as U,n as ue,u as de}from"./Tooltip-CjyHKpY1.js";import{t as fe}from"./ChevronRight-ClAMSliO.js";function W(e={},t){let n=A({ctrl:!1,command:!1,win:!1,shift:!1,tab:!1}),{keydown:r,keyup:a}=e,o=e=>{switch(e.key){case`Control`:n.ctrl=!0;break;case`Meta`:n.command=!0,n.win=!0;break;case`Shift`:n.shift=!0;break;case`Tab`:n.tab=!0}r!==void 0&&Object.keys(r).forEach(t=>{if(t!==e.key)return;let n=r[t];if(typeof n==`function`)n(e);else{let{stop:t=!1,prevent:r=!1}=n;t&&e.stopPropagation(),r&&e.preventDefault(),n.handler(e)}})},s=e=>{switch(e.key){case`Control`:n.ctrl=!1;break;case`Meta`:n.command=!1,n.win=!1;break;case`Shift`:n.shift=!1;break;case`Tab`:n.tab=!1}a!==void 0&&Object.keys(a).forEach(t=>{if(t!==e.key)return;let n=a[t];if(typeof n==`function`)n(e);else{let{stop:t=!1,prevent:r=!1}=n;t&&e.stopPropagation(),r&&e.preventDefault(),n.handler(e)}})},c=()=>{(t===void 0||t.value)&&(z(`keydown`,document,o),z(`keyup`,document,s)),t!==void 0&&p(t,e=>{e?(z(`keydown`,document,o),z(`keyup`,document,s)):(B(`keydown`,document,o),B(`keyup`,document,s))})};return R()?(i(c),u(()=>{(t===void 0||t.value)&&(B(`keydown`,document,o),B(`keyup`,document,s))})):c(),w(n)}function G(e){return t=>{e.value=t?t.$el:null}}var K=M(`n-dropdown-menu`),q=M(`n-dropdown`),J=M(`n-dropdown-option`),Y=S({name:`DropdownDivider`,props:{clsPrefix:{type:String,required:!0}},render(){return n(),t(`div`,{class:O(`${this.clsPrefix}-dropdown-divider`)},null,2)}});function X(e,t){return e.type===`submenu`||e.type===void 0&&e[t]!==void 0}function pe(e){return e.type===`group`}function Z(e){return e.type===`divider`}function me(e){return e.type===`render`}function he(e,t,n){if(!t)return e;let r=E(e.value),i=null;return p(e,e=>{i!==null&&window.clearTimeout(i),e===!0?n&&!n.value?r.value=!0:i=window.setTimeout(()=>{r.value=!0},t):r.value=!1}),r}var Q=S({name:`DropdownOption`,props:{clsPrefix:{type:String,required:!0},tmNode:{type:Object,required:!0},parentKey:{type:[String,Number],default:null},placement:{type:String,default:`right-start`},props:Object,scrollable:Boolean},setup(e){let t=o(q),{hoverKeyRef:n,keyboardKeyRef:r,lastToggledSubmenuKeyRef:i,pendingKeyPathRef:a,activeKeyPathRef:c,animatedRef:l,mergedShowRef:u,renderLabelRef:f,renderIconRef:p,labelFieldRef:m,childrenFieldRef:h,renderOptionRef:g,nodePropsRef:_,menuPropsRef:v}=t,y=o(J,null),b=o(K),x=o(V),S=P(()=>e.tmNode.rawNode),C=P(()=>{let{value:t}=h;return X(e.tmNode.rawNode,t)}),w=P(()=>{let{disabled:t}=e.tmNode;return t}),T=he(P(()=>{if(!C.value)return!1;let{key:t,disabled:o}=e.tmNode;if(o)return!1;let{value:s}=n,{value:c}=r,{value:l}=i,{value:u}=a;return s===null?c===null?l!==null&&u.includes(t):u.includes(t)&&u[u.length-1]!==t:u.includes(t)}),300,P(()=>r.value===null&&!l.value)),D=P(()=>!!y?.enteringSubmenuRef.value),O=E(!1);d(J,{enteringSubmenuRef:O});function k(){O.value=!0}function A(){O.value=!1}function j(){let{parentKey:t,tmNode:a}=e;a.disabled||u.value&&(i.value=t,r.value=null,n.value=a.key)}function M(){let{tmNode:t}=e;t.disabled||u.value&&n.value!==t.key&&j()}function N(t){if(e.tmNode.disabled||!u.value)return;let{relatedTarget:r}=t;r&&!H({target:r},`dropdownOption`)&&!H({target:r},`scrollbarRail`)&&(n.value=null)}function F(){let{value:n}=C,{tmNode:r}=e;u.value&&!n&&!r.disabled&&(t.doSelect(r.key,r.rawNode),t.doUpdateShow(!1))}return{labelField:m,renderLabel:f,renderIcon:p,siblingHasIcon:b.showIconRef,siblingHasSubmenu:b.hasSubmenuRef,menuProps:v,popoverBody:x,animated:l,mergedShowSubmenu:P(()=>T.value&&!D.value),rawNode:S,hasSubmenu:C,pending:s(()=>{let{value:t}=a,{key:n}=e.tmNode;return t.includes(n)}),childActive:s(()=>{let{value:t}=c,{key:n}=e.tmNode,r=t.findIndex(e=>n===e);return r!==-1&&r<t.length-1}),active:s(()=>{let{value:t}=c,{key:n}=e.tmNode,r=t.findIndex(e=>n===e);return r!==-1&&r===t.length-1}),mergedDisabled:w,renderOption:g,nodeProps:_,handleClick:F,handleMouseMove:M,handleMouseEnter:j,handleMouseLeave:N,handleSubmenuBeforeEnter:k,handleSubmenuAfterEnter:A}},render(){let{animated:e,rawNode:r,mergedShowSubmenu:i,clsPrefix:a,siblingHasIcon:o,siblingHasSubmenu:s,renderLabel:l,renderIcon:u,renderOption:d,nodeProps:f,props:p,scrollable:m}=this,h=null;if(i){let e=this.menuProps?.(r,r.children);h=(t=>(n(),N($,c({key:1},e,{clsPrefix:a,scrollable:this.scrollable,tmNodes:this.tmNode.children,parentKey:this.tmNode.key}),null,16,[`clsPrefix`,`scrollable`,`tmNodes`,`parentKey`])))(h)}let g={class:[`${a}-dropdown-option-body`,this.pending&&`${a}-dropdown-option-body--pending`,this.active&&`${a}-dropdown-option-body--active`,this.childActive&&`${a}-dropdown-option-body--child-active`,this.mergedDisabled&&`${a}-dropdown-option-body--disabled`],onMousemove:this.handleMouseMove,onMouseenter:this.handleMouseEnter,onMouseleave:this.handleMouseLeave,onClick:this.handleClick},v=f?.(r),b=(n(),t(`div`,c({class:[`${a}-dropdown-option`,v?.class],"data-dropdown-option":!0},v),[j(()=>x(`div`,c(g,p),[(n(),t(`div`,{class:O([`${a}-dropdown-option-body__prefix`,o&&`${a}-dropdown-option-body__prefix--show-icon`])},[j(()=>[u?u(r):I(r.icon)])],2)),(n(),t(`div`,{"data-dropdown-option":!0,class:O(`${a}-dropdown-option-body__label`)},[l?(n(),t(y,{key:0},[j(()=>l(r))],64)):(n(),t(y,{key:1},[j(()=>I(r[this.labelField]??r.title))],64))],2)),(n(),t(`div`,{"data-dropdown-option":!0,class:O([`${a}-dropdown-option-body__suffix`,s&&`${a}-dropdown-option-body__suffix--has-submenu`])},[this.hasSubmenu?(n(),N(F,{key:0},{_:1,default:_(()=>(n(),N(fe)))})):j(()=>null)],2))])),this.hasSubmenu?(n(),N(ce,{key:0},{default:()=>[(n(),N(le,null,{default:()=>(n(),t(`div`,{class:O(`${a}-dropdown-offset-container`)},[(n(),N(se,{show:this.mergedShowSubmenu,placement:this.placement,to:m&&this.popoverBody||void 0,teleportDisabled:!m},{default:()=>(n(),t(`div`,{class:O(`${a}-dropdown-menu-wrapper`)},[e?(n(),N(D,{key:0,onBeforeEnter:this.handleSubmenuBeforeEnter,onAfterEnter:this.handleSubmenuAfterEnter,name:`fade-in-scale-up-transition`,appear:!0},{default:()=>h},1032,[`onBeforeEnter`,`onAfterEnter`])):(n(),t(y,{key:1},[j(()=>h)],64))],2))},1032,[`show`,`placement`,`to`,`teleportDisabled`]))],2))},1024))]},1024)):j(()=>null)],16));return d?d({node:b,option:r}):b}}),ge=S({name:`DropdownGroupHeader`,props:{clsPrefix:{type:String,required:!0},tmNode:{type:Object,required:!0}},setup(){let{showIconRef:e,hasSubmenuRef:t}=o(K),{renderLabelRef:n,labelFieldRef:r,nodePropsRef:i,renderOptionRef:a}=o(q);return{labelField:r,showIcon:e,hasSubmenu:t,renderLabel:n,nodeProps:i,renderOption:a}},render(){let{clsPrefix:e,hasSubmenu:r,showIcon:i,nodeProps:a,renderLabel:o,renderOption:s}=this,{rawNode:l}=this.tmNode,u=(n(),t(`div`,c({class:`${e}-dropdown-option`},a?.(l)),[h(`div`,{class:O(`${e}-dropdown-option-body ${e}-dropdown-option-body--group`)},[h(`div`,{"data-dropdown-option":!0,class:O([`${e}-dropdown-option-body__prefix`,i&&`${e}-dropdown-option-body__prefix--show-icon`])},[j(()=>I(l.icon))],2),h(`div`,{class:O(`${e}-dropdown-option-body__label`),"data-dropdown-option":!0},[o?(n(),t(y,{key:0},[j(()=>o(l))],64)):(n(),t(y,{key:1},[j(()=>I(l.title??l[this.labelField]))],64))],2),h(`div`,{class:O([`${e}-dropdown-option-body__suffix`,r&&`${e}-dropdown-option-body__suffix--has-submenu`]),"data-dropdown-option":!0},null,2)],2)],16));return s?s({node:u,option:l}):u}}),_e=S({name:`NDropdownGroup`,props:{clsPrefix:{type:String,required:!0},tmNode:{type:Object,required:!0},parentKey:{type:[String,Number],default:null}},render(){let{tmNode:e,parentKey:r,clsPrefix:i}=this,{children:a}=e;return n(),t(y,null,[(n(),N(ge,{clsPrefix:i,tmNode:e,key:e.key},null,8,[`clsPrefix`,`tmNode`])),j(()=>a?.map(e=>{let{rawNode:t}=e;return t.show===!1?null:Z(t)?x(Y,{clsPrefix:i,key:e.key}):e.isGroup?(g(`dropdown`,"`group` node is not allowed to be put in `group` node."),null):(n(),N(Q,{clsPrefix:i,tmNode:e,parentKey:r,key:e.key},null,8,[`clsPrefix`,`tmNode`,`parentKey`]))}))],64)}}),ve=S({name:`DropdownRenderOption`,props:{tmNode:{type:Object,required:!0}},render(){let{rawNode:{render:e,props:t}}=this.tmNode;return x(`div`,t,[e?.()])}}),$=S({name:`DropdownMenu`,props:{scrollable:Boolean,showArrow:Boolean,arrowStyle:[String,Object],clsPrefix:{type:String,required:!0},tmNodes:{type:Array,default:()=>[]},parentKey:{type:[String,Number],default:null}},setup(e){let{renderIconRef:t,childrenFieldRef:n}=o(q);d(K,{showIconRef:P(()=>{let n=t.value;return e.tmNodes.some(e=>{if(e.isGroup)return e.children?.some(({rawNode:e})=>n?n(e):e.icon);let{rawNode:t}=e;return n?n(t):t.icon})}),hasSubmenuRef:P(()=>{let{value:t}=n;return e.tmNodes.some(e=>{if(e.isGroup)return e.children?.some(({rawNode:e})=>X(e,t));let{rawNode:n}=e;return X(n,t)})})});let r=E(null);return d(re,null),d(L,null),d(V,r),{bodyRef:r}},render(){let{parentKey:e,clsPrefix:r,scrollable:i}=this,a=this.tmNodes.map(t=>{let{rawNode:a}=t;return a.show===!1?null:me(a)?(n(),N(ve,{tmNode:t,key:t.key},null,8,[`tmNode`])):Z(a)?(n(),N(Y,{clsPrefix:r,key:t.key},null,8,[`clsPrefix`])):pe(a)?(n(),N(_e,{clsPrefix:r,tmNode:t,parentKey:e,key:t.key},null,8,[`clsPrefix`,`tmNode`,`parentKey`])):(n(),N(Q,{clsPrefix:r,tmNode:t,parentKey:e,key:t.key,props:a.props,scrollable:i},null,8,[`clsPrefix`,`tmNode`,`parentKey`,`props`,`scrollable`]))});return n(),t(`div`,{class:O([`${r}-dropdown-menu`,i&&`${r}-dropdown-menu--scrollable`]),ref:`bodyRef`},[i?(n(),N(ie,{key:0,contentClass:`${r}-dropdown-menu__content`},{default:()=>a},1032,[`contentClass`])):(n(),t(y,{key:1},[j(()=>a)],64)),this.showArrow?(n(),t(y,{key:2},[j(()=>de({clsPrefix:r,arrowStyle:this.arrowStyle,arrowClass:void 0,arrowWrapperClass:void 0,arrowWrapperStyle:void 0}))],64)):j(()=>null)],2)}}),ye=m(`dropdown-menu`,`
 transform-origin: var(--v-transform-origin);
 background-color: var(--n-color);
 border-radius: var(--n-border-radius);
 box-shadow: var(--n-box-shadow);
 position: relative;
 transition:
 background-color .3s var(--n-bezier),
 box-shadow .3s var(--n-bezier);
`,[ne(),m(`dropdown-option`,`
 position: relative;
 `,[f(`a`,`
 text-decoration: none;
 color: inherit;
 outline: none;
 `,[f(`&::before`,`
 content: "";
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 bottom: 0;
 `)]),m(`dropdown-option-body`,`
 display: flex;
 cursor: pointer;
 position: relative;
 height: var(--n-option-height);
 line-height: var(--n-option-height);
 font-size: var(--n-font-size);
 color: var(--n-option-text-color);
 transition: color .3s var(--n-bezier);
 `,[f(`&::before`,`
 content: "";
 position: absolute;
 top: 0;
 bottom: 0;
 left: 4px;
 right: 4px;
 transition: background-color .3s var(--n-bezier);
 border-radius: var(--n-border-radius);
 `),k(`disabled`,[v(`pending`,`
 color: var(--n-option-text-color-hover);
 `,[e(`prefix, suffix`,`
 color: var(--n-option-text-color-hover);
 `),f(`&::before`,`background-color: var(--n-option-color-hover);`)]),v(`active`,`
 color: var(--n-option-text-color-active);
 `,[e(`prefix, suffix`,`
 color: var(--n-option-text-color-active);
 `),f(`&::before`,`background-color: var(--n-option-color-active);`)]),v(`child-active`,`
 color: var(--n-option-text-color-child-active);
 `,[e(`prefix, suffix`,`
 color: var(--n-option-text-color-child-active);
 `)])]),v(`disabled`,`
 cursor: not-allowed;
 opacity: var(--n-option-opacity-disabled);
 `),v(`group`,`
 font-size: calc(var(--n-font-size) - 1px);
 color: var(--n-group-header-text-color);
 `,[e(`prefix`,`
 width: calc(var(--n-option-prefix-width) / 2);
 `,[v(`show-icon`,`
 width: calc(var(--n-option-icon-prefix-width) / 2);
 `)])]),e(`prefix`,`
 width: var(--n-option-prefix-width);
 display: flex;
 justify-content: center;
 align-items: center;
 color: var(--n-prefix-color);
 transition: color .3s var(--n-bezier);
 z-index: 1;
 `,[v(`show-icon`,`
 width: var(--n-option-icon-prefix-width);
 `),m(`icon`,`
 font-size: var(--n-option-icon-size);
 `)]),e(`label`,`
 white-space: nowrap;
 flex: 1;
 z-index: 1;
 `),e(`suffix`,`
 box-sizing: border-box;
 flex-grow: 0;
 flex-shrink: 0;
 display: flex;
 justify-content: flex-end;
 align-items: center;
 min-width: var(--n-option-suffix-width);
 padding: 0 8px;
 transition: color .3s var(--n-bezier);
 color: var(--n-suffix-color);
 z-index: 1;
 `,[v(`has-submenu`,`
 width: var(--n-option-icon-suffix-width);
 `),m(`icon`,`
 font-size: var(--n-option-icon-size);
 `)]),m(`dropdown-menu`,`pointer-events: all;`)]),m(`dropdown-offset-container`,`
 pointer-events: none;
 position: absolute;
 left: 0;
 right: 0;
 top: -4px;
 bottom: -4px;
 `)]),m(`dropdown-divider`,`
 transition: background-color .3s var(--n-bezier);
 background-color: var(--n-divider-color);
 height: 1px;
 margin: 4px 0;
 `),m(`dropdown-menu-wrapper`,`
 transform-origin: var(--v-transform-origin);
 width: fit-content;
 `),f(`>`,[m(`scrollbar`,`
 height: inherit;
 max-height: inherit;
 `)]),k(`scrollable`,`
 padding: var(--n-padding);
 `),v(`scrollable`,[e(`content`,`
 padding: var(--n-padding);
 `)])]),be={animated:{type:Boolean,default:!0},keyboard:{type:Boolean,default:!0},size:String,inverted:Boolean,placement:{type:String,default:`bottom`},onSelect:[Function,Array],options:{type:Array,default:()=>[]},menuProps:Function,showArrow:Boolean,renderLabel:Function,renderIcon:Function,renderOption:Function,nodeProps:Function,labelField:{type:String,default:`label`},keyField:{type:String,default:`key`},childrenField:{type:String,default:`children`},value:[String,Number]},xe=Object.keys(U),Se={...U,...be,...r.props},Ce=S({name:`Dropdown`,inheritAttrs:!1,props:Se,setup(e){let t=E(!1),n=ee(T(e,`show`),t),i=P(()=>{let{keyField:t,childrenField:n}=e;return ue(e.options,{getKey(e){return e[t]},getDisabled(e){return e.disabled===!0},getIgnored(e){return e.type===`divider`||e.type===`render`},getChildren(e){return e[n]}})}),o=P(()=>i.value.treeNodes),c=E(null),u=E(null),f=E(null),m=P(()=>c.value??u.value??f.value??null),h=P(()=>i.value.getPath(m.value).keyPath),g=P(()=>i.value.getPath(e.value).keyPath),_=s(()=>e.keyboard&&n.value);W({keydown:{ArrowUp:{prevent:!0,handler:N},ArrowRight:{prevent:!0,handler:M},ArrowDown:{prevent:!0,handler:F},ArrowLeft:{prevent:!0,handler:j},Enter:{prevent:!0,handler:I},Escape:A}},_);let{mergedClsPrefixRef:v,inlineThemeDisabled:y,mergedComponentPropsRef:x}=b(e),S=P(()=>e.size||x?.value?.Dropdown?.size||`medium`),w=r(`Dropdown`,`-dropdown`,ye,te,e,v);d(q,{labelFieldRef:T(e,`labelField`),childrenFieldRef:T(e,`childrenField`),renderLabelRef:T(e,`renderLabel`),renderIconRef:T(e,`renderIcon`),hoverKeyRef:c,keyboardKeyRef:u,lastToggledSubmenuKeyRef:f,pendingKeyPathRef:h,activeKeyPathRef:g,animatedRef:T(e,`animated`),mergedShowRef:n,nodePropsRef:T(e,`nodeProps`),renderOptionRef:T(e,`renderOption`),menuPropsRef:T(e,`menuProps`),doSelect:D,doUpdateShow:O}),p(n,t=>{!e.animated&&!t&&k()});function D(t,n){let{onSelect:r}=e;r&&a(r,t,n)}function O(n){let{"onUpdate:show":r,onUpdateShow:i}=e;r&&a(r,n),i&&a(i,n),t.value=n}function k(){c.value=null,u.value=null,f.value=null}function A(){O(!1)}function j(){R(`left`)}function M(){R(`right`)}function N(){R(`up`)}function F(){R(`down`)}function I(){let e=L();e?.isLeaf&&n.value&&(D(e.key,e.rawNode),O(!1))}function L(){let{value:e}=i,{value:t}=m;return!e||t===null?null:e.getNode(t)??null}function R(e){let{value:t}=m,{value:{getFirstAvailableNode:n}}=i,r=null;if(t===null){let e=n();e!==null&&(r=e.key)}else{let t=L();if(t){let n;switch(e){case`down`:n=t.getNext();break;case`up`:n=t.getPrev();break;case`right`:n=t.getChild();break;case`left`:n=t.getParent()}n&&(r=n.key)}}r!==null&&(c.value=null,u.value=r)}let z=P(()=>{let{inverted:t}=e,n=S.value,{common:{cubicBezierEaseInOut:r},self:i}=w.value,{padding:a,dividerColor:o,borderRadius:s,optionOpacityDisabled:c,[C(`optionIconSuffixWidth`,n)]:l,[C(`optionSuffixWidth`,n)]:u,[C(`optionIconPrefixWidth`,n)]:d,[C(`optionPrefixWidth`,n)]:f,[C(`fontSize`,n)]:p,[C(`optionHeight`,n)]:m,[C(`optionIconSize`,n)]:h}=i,g={"--n-bezier":r,"--n-font-size":p,"--n-padding":a,"--n-border-radius":s,"--n-option-height":m,"--n-option-prefix-width":f,"--n-option-icon-prefix-width":d,"--n-option-suffix-width":u,"--n-option-icon-suffix-width":l,"--n-option-icon-size":h,"--n-divider-color":o,"--n-option-opacity-disabled":c};return t?(g[`--n-color`]=i.colorInverted,g[`--n-option-color-hover`]=i.optionColorHoverInverted,g[`--n-option-color-active`]=i.optionColorActiveInverted,g[`--n-option-text-color`]=i.optionTextColorInverted,g[`--n-option-text-color-hover`]=i.optionTextColorHoverInverted,g[`--n-option-text-color-active`]=i.optionTextColorActiveInverted,g[`--n-option-text-color-child-active`]=i.optionTextColorChildActiveInverted,g[`--n-prefix-color`]=i.prefixColorInverted,g[`--n-suffix-color`]=i.suffixColorInverted,g[`--n-group-header-text-color`]=i.groupHeaderTextColorInverted):(g[`--n-color`]=i.color,g[`--n-option-color-hover`]=i.optionColorHover,g[`--n-option-color-active`]=i.optionColorActive,g[`--n-option-text-color`]=i.optionTextColor,g[`--n-option-text-color-hover`]=i.optionTextColorHover,g[`--n-option-text-color-active`]=i.optionTextColorActive,g[`--n-option-text-color-child-active`]=i.optionTextColorChildActive,g[`--n-prefix-color`]=i.prefixColor,g[`--n-suffix-color`]=i.suffixColor,g[`--n-group-header-text-color`]=i.groupHeaderTextColor),g}),B=y?l(`dropdown`,P(()=>`${S.value[0]}${e.inverted?`i`:``}`),z,e):void 0;return{mergedClsPrefix:v,mergedTheme:w,mergedSize:S,tmNodes:o,mergedShow:n,handleAfterLeave:()=>{e.animated&&k()},doUpdateShow:O,cssVars:y?void 0:z,themeClass:B?.themeClass,onRender:B?.onRender}},render(){let e=(e,t,n,r,i)=>{let{mergedClsPrefix:a,menuProps:o}=this;this.onRender?.();let s=o?.(void 0,this.tmNodes.map(e=>e.rawNode))||{},l={ref:G(t),class:[e,`${a}-dropdown`,`${a}-dropdown--${this.mergedSize}-size`,this.themeClass],clsPrefix:a,tmNodes:this.tmNodes,style:[...n,this.cssVars],showArrow:this.showArrow,arrowStyle:this.arrowStyle,scrollable:this.scrollable,onMouseenter:r,onMouseleave:i};return x($,c(this.$attrs,l,s))},{mergedTheme:t}=this,r={show:this.mergedShow,theme:t.peers.Popover,themeOverrides:t.peerOverrides.Popover,internalOnAfterLeave:this.handleAfterLeave,internalRenderBody:e,onUpdateShow:this.doUpdateShow,"onUpdate:show":void 0};return n(),N(oe,ae(this.$props,xe,r),{_:1,trigger:_(()=>this.$slots.default?.())},16)}});export{G as n,W as r,Ce as t};