import{$t as e,Bn as t,Cn as n,Dn as r,En as i,F as a,Fn as o,Hn as s,I as c,Kn as l,L as u,M as d,Mn as f,P as p,Pn as m,R as h,Rn as g,Sn as _,Un as v,V as y,Wn as b,Xn as x,Xt as S,Yn as C,Zn as w,Zt as T,bn as E,cr as D,en as O,hn as k,ht as A,jn as j,kn as M,lr as N,lt as P,or as F,ot as I,qn as ee,r as L,rr as R,sr as z,st as B,tn as V,ur as H,ut as U,v as te,vt as W,xn as G,yn as K,z as ne}from"./light-C36WBRZZ.js";import{n as q,o as re,s as ie,t as ae}from"./_plugin-vue_export-helper-Y2v3pMRv.js";import{$ as J,E as oe,Ft as se,It as ce,Ut as le,_ as ue,c as de,lt as fe,nt as pe,ot as me,s as Y,t as he,vt as ge,yt as _e}from"./discrete-BMBIarA6.js";import{S as ve,d as ye,i as be,n as xe,t as Se,v as Ce}from"./Tooltip-CjyHKpY1.js";import{t as we}from"./Dropdown-CZVuupRt.js";import{i as Te,o as Ee}from"./http-BtemuouQ.js";import{t as De}from"./Avatar-8sGsb8yn.js";import{t as Oe}from"./ChevronRight-ClAMSliO.js";import{n as ke,t as Ae}from"./DrawerContent-Bx6Kdnr9.js";import{c as je,i as Me,n as X,o as Ne,r as Z,s as Pe}from"./index-DoSTyET8.js";import{t as Fe}from"./CashOutline-C8a1-qOe.js";import{t as Ie}from"./ChevronBackOutline-CXyVUorD.js";import{t as Le}from"./ChevronForwardOutline-BPr-Ur3A.js";import{n as Re,r as ze,t as Be}from"./SunnyOutline-DBqUUINS.js";import{a as Ve,i as He,n as Ue,o as We,t as Ge}from"./plugins-D1E1Urn7.js";import{t as Ke}from"./PeopleOutline-BDyV8lBY.js";import{t as qe}from"./SearchOutline-C88WxZDn.js";import{t as Je}from"./ServerOutline-Bmj6YaaI.js";function Ye(e){let{baseColor:t,textColor2:n,bodyColor:r,cardColor:i,dividerColor:a,actionColor:o,scrollbarColor:s,scrollbarColorHover:c,invertedColor:l}=e;return{textColor:n,textColorInverted:`#FFF`,color:r,colorEmbedded:o,headerColor:i,headerColorInverted:l,footerColor:o,footerColorInverted:l,headerBorderColor:a,headerBorderColorInverted:l,footerBorderColor:a,footerBorderColorInverted:l,siderBorderColor:a,siderBorderColorInverted:l,siderColor:i,siderColorInverted:l,siderToggleButtonBorder:`1px solid ${a}`,siderToggleButtonColor:t,siderToggleButtonIconColor:n,siderToggleButtonIconColorInverted:n,siderToggleBarColor:y(r,s),siderToggleBarColorHover:y(r,c),__invertScrollbar:`true`}}var Xe=c({name:`Layout`,common:ne,peers:{Scrollbar:se},self:Ye}),Ze=W(`n-layout-sider`),Qe={type:String,default:`static`},$e=T(`layout`,`
 color: var(--n-text-color);
 background-color: var(--n-color);
 box-sizing: border-box;
 position: relative;
 z-index: auto;
 flex: auto;
 overflow: hidden;
 transition:
 box-shadow .3s var(--n-bezier),
 background-color .3s var(--n-bezier),
 color .3s var(--n-bezier);
`,[T(`layout-scroll-container`,`
 overflow-x: hidden;
 box-sizing: border-box;
 height: 100%;
 `),O(`absolute-positioned`,`
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 bottom: 0;
 `)]),et={embedded:Boolean,position:Qe,nativeScrollbar:{type:Boolean,default:!0},scrollbarProps:Object,onScroll:Function,contentClass:String,contentStyle:{type:[String,Object],default:``},hasSider:Boolean,siderPlacement:{type:String,default:`left`}},tt=W(`n-layout`);function nt(e){return M({name:e?`LayoutContent`:`Layout`,props:{...u.props,...et},setup(e){let t=R(null),n=R(null),{mergedClsPrefixRef:r,inlineThemeDisabled:i}=A(e),a=u(`Layout`,`-layout`,$e,Xe,e,r);function o(r,i){if(e.nativeScrollbar){let{value:e}=t;e&&(i===void 0?e.scrollTo(r):e.scrollTo(r,i))}else{let{value:e}=n;e&&e.scrollTo(r,i)}}v(tt,e);let s=0,c=0,l=t=>{let n=t.target;s=n.scrollLeft,c=n.scrollTop,e.onScroll?.(t)};ge(()=>{if(e.nativeScrollbar){let e=t.value;e&&(e.scrollTop=c,e.scrollLeft=s)}});let d={display:`flex`,flexWrap:`nowrap`,width:`100%`,flexDirection:`row`},f={scrollTo:o},p=K(()=>{let{common:{cubicBezierEaseInOut:t},self:n}=a.value;return{"--n-bezier":t,"--n-color":e.embedded?n.colorEmbedded:n.color,"--n-text-color":n.textColor}}),m=i?h(`layout`,K(()=>e.embedded?`e`:``),p,e):void 0;return{mergedClsPrefix:r,scrollableElRef:t,scrollbarInstRef:n,hasSiderStyle:d,mergedTheme:a,handleNativeElScroll:l,cssVars:i?void 0:p,themeClass:m?.themeClass,onRender:m?.onRender,...f}},render(){let{mergedClsPrefix:t,hasSider:r}=this;this.onRender?.();let i=r?this.hasSiderStyle:void 0,a=[this.themeClass,e&&`${t}-layout-content`,`${t}-layout`,`${t}-layout--${this.position}-positioned`];return s(),n(`div`,{class:B(a),style:N(this.cssVars)},[this.nativeScrollbar?(s(),n(`div`,{key:0,ref:`scrollableElRef`,class:B([`${t}-layout-scroll-container`,this.contentClass]),style:N([this.contentStyle,i]),onScroll:this.handleNativeElScroll},[U(()=>this.$slots.default?.())],46,[`onScroll`])):(s(),G(me,m({key:1},this.scrollbarProps,{onScroll:this.onScroll,ref:`scrollbarInstRef`,theme:this.mergedTheme.peers.Scrollbar,themeOverrides:this.mergedTheme.peerOverrides.Scrollbar,contentClass:this.contentClass,contentStyle:[this.contentStyle,i]}),P(this.$slots),1040,[`onScroll`,`theme`,`themeOverrides`,`contentClass`,`contentStyle`]))],6)}})}var rt=nt(!1),it=nt(!0),at=T(`layout-header`,`
 transition:
 color .3s var(--n-bezier),
 background-color .3s var(--n-bezier),
 box-shadow .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
 box-sizing: border-box;
 width: 100%;
 background-color: var(--n-color);
 color: var(--n-text-color);
`,[O(`absolute-positioned`,`
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 `),O(`bordered`,`
 border-bottom: solid 1px var(--n-border-color);
 `)]),ot={position:Qe,inverted:Boolean,bordered:Boolean},st=M({name:`LayoutHeader`,props:{...u.props,...ot},setup(e){let{mergedClsPrefixRef:t,inlineThemeDisabled:n}=A(e),r=u(`Layout`,`-layout-header`,at,Xe,e,t),i=K(()=>{let{common:{cubicBezierEaseInOut:t},self:n}=r.value,i={"--n-bezier":t};return e.inverted?(i[`--n-color`]=n.headerColorInverted,i[`--n-text-color`]=n.textColorInverted,i[`--n-border-color`]=n.headerBorderColorInverted):(i[`--n-color`]=n.headerColor,i[`--n-text-color`]=n.textColor,i[`--n-border-color`]=n.headerBorderColor),i}),a=n?h(`layout-header`,K(()=>e.inverted?`a`:`b`),i,e):void 0;return{mergedClsPrefix:t,cssVars:n?void 0:i,themeClass:a?.themeClass,onRender:a?.onRender}},render(){let{mergedClsPrefix:e}=this;return this.onRender?.(),s(),n(`div`,{class:B([`${e}-layout-header`,this.themeClass,this.position&&`${e}-layout-header--${this.position}-positioned`,this.bordered&&`${e}-layout-header--bordered`]),style:N(this.cssVars)},[U(()=>this.$slots.default?.())],6)}}),ct=T(`layout-sider`,`
 flex-shrink: 0;
 box-sizing: border-box;
 position: relative;
 z-index: 1;
 color: var(--n-text-color);
 transition:
 color .3s var(--n-bezier),
 border-color .3s var(--n-bezier),
 min-width .3s var(--n-bezier),
 max-width .3s var(--n-bezier),
 transform .3s var(--n-bezier),
 background-color .3s var(--n-bezier);
 background-color: var(--n-color);
 display: flex;
 justify-content: flex-end;
`,[O(`bordered`,[e(`border`,`
 content: "";
 position: absolute;
 top: 0;
 bottom: 0;
 width: 1px;
 background-color: var(--n-border-color);
 transition: background-color .3s var(--n-bezier);
 `)]),e(`left-placement`,[O(`bordered`,[e(`border`,`
 right: 0;
 `)])]),O(`right-placement`,`
 justify-content: flex-start;
 `,[O(`bordered`,[e(`border`,`
 left: 0;
 `)]),O(`collapsed`,[T(`layout-toggle-button`,[T(`base-icon`,`
 transform: rotate(180deg);
 `)]),T(`layout-toggle-bar`,[S(`&:hover`,[e(`top`,{transform:`rotate(-12deg) scale(1.15) translateY(-2px)`}),e(`bottom`,{transform:`rotate(12deg) scale(1.15) translateY(2px)`})])])]),T(`layout-toggle-button`,`
 left: 0;
 transform: translateX(-50%) translateY(-50%);
 `,[T(`base-icon`,`
 transform: rotate(0);
 `)]),T(`layout-toggle-bar`,`
 left: -28px;
 transform: rotate(180deg);
 `,[S(`&:hover`,[e(`top`,{transform:`rotate(12deg) scale(1.15) translateY(-2px)`}),e(`bottom`,{transform:`rotate(-12deg) scale(1.15) translateY(2px)`})])])]),O(`collapsed`,[T(`layout-toggle-bar`,[S(`&:hover`,[e(`top`,{transform:`rotate(-12deg) scale(1.15) translateY(-2px)`}),e(`bottom`,{transform:`rotate(12deg) scale(1.15) translateY(2px)`})])]),T(`layout-toggle-button`,[T(`base-icon`,`
 transform: rotate(0);
 `)])]),T(`layout-toggle-button`,`
 transition:
 color .3s var(--n-bezier),
 right .3s var(--n-bezier),
 left .3s var(--n-bezier),
 border-color .3s var(--n-bezier),
 background-color .3s var(--n-bezier);
 cursor: pointer;
 width: 24px;
 height: 24px;
 position: absolute;
 top: 50%;
 right: 0;
 border-radius: 50%;
 display: flex;
 align-items: center;
 justify-content: center;
 font-size: 18px;
 color: var(--n-toggle-button-icon-color);
 border: var(--n-toggle-button-border);
 background-color: var(--n-toggle-button-color);
 box-shadow: 0 2px 4px 0px rgba(0, 0, 0, .06);
 transform: translateX(50%) translateY(-50%);
 z-index: 1;
 `,[T(`base-icon`,`
 transition: transform .3s var(--n-bezier);
 transform: rotate(180deg);
 `)]),T(`layout-toggle-bar`,`
 cursor: pointer;
 height: 72px;
 width: 32px;
 position: absolute;
 top: calc(50% - 36px);
 right: -28px;
 `,[e(`top, bottom`,`
 position: absolute;
 width: 4px;
 border-radius: 2px;
 height: 38px;
 left: 14px;
 transition: 
 background-color .3s var(--n-bezier),
 transform .3s var(--n-bezier);
 `),e(`bottom`,`
 position: absolute;
 top: 34px;
 `),S(`&:hover`,[e(`top`,{transform:`rotate(12deg) scale(1.15) translateY(-2px)`}),e(`bottom`,{transform:`rotate(-12deg) scale(1.15) translateY(2px)`})]),e(`top, bottom`,{backgroundColor:`var(--n-toggle-bar-color)`}),S(`&:hover`,[e(`top, bottom`,{backgroundColor:`var(--n-toggle-bar-color-hover)`})])]),e(`border`,`
 position: absolute;
 top: 0;
 right: 0;
 bottom: 0;
 width: 1px;
 transition: background-color .3s var(--n-bezier);
 `),T(`layout-sider-scroll-container`,`
 flex-grow: 1;
 flex-shrink: 0;
 box-sizing: border-box;
 height: 100%;
 opacity: 0;
 transition: opacity .3s var(--n-bezier);
 max-width: 100%;
 `),O(`show-content`,[T(`layout-sider-scroll-container`,{opacity:1})]),O(`absolute-positioned`,`
 position: absolute;
 left: 0;
 top: 0;
 bottom: 0;
 `)]),lt=[`onClick`],ut=M({props:{clsPrefix:{type:String,required:!0},onClick:Function},render(){let{clsPrefix:e}=this;return s(),n(`div`,{onClick:this.onClick,class:B(`${e}-layout-toggle-bar`)},[E(`div`,{class:B(`${e}-layout-toggle-bar__top`)},null,2),E(`div`,{class:B(`${e}-layout-toggle-bar__bottom`)},null,2)],10,lt)}}),dt=[`onClick`],ft=M({name:`LayoutToggleButton`,props:{clsPrefix:{type:String,required:!0},onClick:Function},render(){let{clsPrefix:e}=this;return s(),n(`div`,{class:B(`${e}-layout-toggle-button`),onClick:this.onClick},[(s(),G(a,{clsPrefix:e},{default:()=>(s(),G(Oe))},1032,[`clsPrefix`]))],10,dt)}}),pt=[`onTransitionend`],mt={position:Qe,bordered:Boolean,collapsedWidth:{type:Number,default:48},width:{type:[Number,String],default:272},contentClass:String,contentStyle:{type:[String,Object],default:``},collapseMode:{type:String,default:`transform`},collapsed:{type:Boolean,default:void 0},defaultCollapsed:Boolean,showCollapsedContent:{type:Boolean,default:!0},showTrigger:{type:[Boolean,String],default:!1},nativeScrollbar:{type:Boolean,default:!0},inverted:Boolean,scrollbarProps:Object,triggerClass:String,triggerStyle:[String,Object],collapsedTriggerClass:String,collapsedTriggerStyle:[String,Object],"onUpdate:collapsed":[Function,Array],onUpdateCollapsed:[Function,Array],onAfterEnter:Function,onAfterLeave:Function,onExpand:[Function,Array],onCollapse:[Function,Array],onScroll:Function},ht=M({name:`LayoutSider`,props:{...u.props,...mt},setup(e){let t=f(tt),n=R(null),r=R(null),i=R(e.defaultCollapsed),a=ie(F(e,`collapsed`),i),o=K(()=>re(a.value?e.collapsedWidth:e.width)),s=K(()=>e.collapseMode===`transform`?{minWidth:re(e.width)}:{}),c=K(()=>t?t.siderPlacement:`left`);function l(t,i){if(e.nativeScrollbar){let{value:e}=n;e&&(i===void 0?e.scrollTo(t):e.scrollTo(t,i))}else{let{value:e}=r;e&&e.scrollTo(t,i)}}function p(){let{"onUpdate:collapsed":t,onUpdateCollapsed:n,onExpand:r,onCollapse:o}=e,{value:s}=a;n&&d(n,!s),t&&d(t,!s),i.value=!s,s?r&&d(r):o&&d(o)}let m=0,g=0,_=t=>{let n=t.target;m=n.scrollLeft,g=n.scrollTop,e.onScroll?.(t)};ge(()=>{if(e.nativeScrollbar){let e=n.value;e&&(e.scrollTop=g,e.scrollLeft=m)}}),v(Ze,{collapsedRef:a,collapseModeRef:F(e,`collapseMode`)});let{mergedClsPrefixRef:y,inlineThemeDisabled:b}=A(e),x=u(`Layout`,`-layout-sider`,ct,Xe,e,y);function S(t){t.propertyName===`max-width`&&(a.value?e.onAfterLeave?.():e.onAfterEnter?.())}let C={scrollTo:l},w=K(()=>{let{common:{cubicBezierEaseInOut:t},self:n}=x.value,{siderToggleButtonColor:r,siderToggleButtonBorder:i,siderToggleBarColor:a,siderToggleBarColorHover:o}=n,s={"--n-bezier":t,"--n-toggle-button-color":r,"--n-toggle-button-border":i,"--n-toggle-bar-color":a,"--n-toggle-bar-color-hover":o};return e.inverted?(s[`--n-color`]=n.siderColorInverted,s[`--n-text-color`]=n.textColorInverted,s[`--n-border-color`]=n.siderBorderColorInverted,s[`--n-toggle-button-icon-color`]=n.siderToggleButtonIconColorInverted,s.__invertScrollbar=n.__invertScrollbar):(s[`--n-color`]=n.siderColor,s[`--n-text-color`]=n.textColor,s[`--n-border-color`]=n.siderBorderColor,s[`--n-toggle-button-icon-color`]=n.siderToggleButtonIconColor),s}),T=b?h(`layout-sider`,K(()=>e.inverted?`a`:`b`),w,e):void 0;return{scrollableElRef:n,scrollbarInstRef:r,mergedClsPrefix:y,mergedTheme:x,styleMaxWidth:o,mergedCollapsed:a,scrollContainerStyle:s,siderPlacement:c,handleNativeElScroll:_,handleTransitionend:S,handleTriggerClick:p,inlineThemeDisabled:b,cssVars:w,themeClass:T?.themeClass,onRender:T?.onRender,...C}},render(){let{mergedClsPrefix:e,mergedCollapsed:t,showTrigger:r}=this;return this.onRender?.(),s(),n(`aside`,{class:B([`${e}-layout-sider`,this.themeClass,`${e}-layout-sider--${this.position}-positioned`,`${e}-layout-sider--${this.siderPlacement}-placement`,this.bordered&&`${e}-layout-sider--bordered`,t&&`${e}-layout-sider--collapsed`,(!t||this.showCollapsedContent)&&`${e}-layout-sider--show-content`]),onTransitionend:this.handleTransitionend,style:N([this.inlineThemeDisabled?void 0:this.cssVars,{maxWidth:this.styleMaxWidth,width:re(this.width)}])},[this.nativeScrollbar?(s(),n(`div`,{key:1,class:B([`${e}-layout-sider-scroll-container`,this.contentClass]),onScroll:this.handleNativeElScroll,style:N([this.scrollContainerStyle,{overflow:`auto`},this.contentStyle]),ref:`scrollableElRef`},[U(()=>this.$slots.default?.())],46,[`onScroll`])):(s(),G(me,m({key:0},this.scrollbarProps,{onScroll:this.onScroll,ref:`scrollbarInstRef`,style:this.scrollContainerStyle,contentStyle:this.contentStyle,contentClass:this.contentClass,theme:this.mergedTheme.peers.Scrollbar,themeOverrides:this.mergedTheme.peerOverrides.Scrollbar,builtinThemeOverrides:this.inverted&&this.cssVars.__invertScrollbar===`true`?{colorHover:`rgba(255, 255, 255, .4)`,color:`rgba(255, 255, 255, .3)`}:void 0}),P(this.$slots),1040,[`onScroll`,`style`,`contentStyle`,`contentClass`,`theme`,`themeOverrides`,`builtinThemeOverrides`])),r?(s(),n(k,{key:2},[r===`bar`?(s(),G(ut,{key:0,clsPrefix:e,class:B(t?this.collapsedTriggerClass:this.triggerClass),style:N(t?this.collapsedTriggerStyle:this.triggerStyle),onClick:this.handleTriggerClick},null,8,[`clsPrefix`,`class`,`style`,`onClick`])):(s(),G(ft,{key:1,clsPrefix:e,class:B(t?this.collapsedTriggerClass:this.triggerClass),style:N(t?this.collapsedTriggerStyle:this.triggerStyle),onClick:this.handleTriggerClick},null,8,[`clsPrefix`,`class`,`style`,`onClick`]))],64)):U(()=>null),this.bordered?(s(),n(`div`,{key:4,class:B(`${e}-layout-sider__border`)},null,2)):U(()=>null)],46,pt)}}),Q=W(`n-menu`),gt=W(`n-submenu`),_t=W(`n-menu-item-group`),vt=[S(`&::before`,`background-color: var(--n-item-color-hover);`),e(`arrow`,`
 color: var(--n-arrow-color-hover);
 `),e(`icon`,`
 color: var(--n-item-icon-color-hover);
 `),T(`menu-item-content-header`,`
 color: var(--n-item-text-color-hover);
 `,[S(`a`,`
 color: var(--n-item-text-color-hover);
 `),e(`extra`,`
 color: var(--n-item-text-color-hover);
 `)])],yt=[e(`icon`,`
 color: var(--n-item-icon-color-hover-horizontal);
 `),T(`menu-item-content-header`,`
 color: var(--n-item-text-color-hover-horizontal);
 `,[S(`a`,`
 color: var(--n-item-text-color-hover-horizontal);
 `),e(`extra`,`
 color: var(--n-item-text-color-hover-horizontal);
 `)])],bt=S([T(`menu`,`
 background-color: var(--n-color);
 color: var(--n-item-text-color);
 overflow: hidden;
 transition: background-color .3s var(--n-bezier);
 box-sizing: border-box;
 font-size: var(--n-font-size);
 padding-bottom: 6px;
 `,[O(`horizontal`,`
 max-width: 100%;
 width: 100%;
 display: flex;
 overflow: hidden;
 padding-bottom: 0;
 `,[T(`submenu`,`margin: 0;`),T(`menu-item`,`margin: 0;`),T(`menu-item-content`,`
 padding: 0 20px;
 border-bottom: 2px solid #0000;
 `,[S(`&::before`,`display: none;`),O(`selected`,`border-bottom: 2px solid var(--n-border-color-horizontal)`)]),T(`menu-item-content`,[O(`selected`,[e(`icon`,`color: var(--n-item-icon-color-active-horizontal);`),T(`menu-item-content-header`,`
 color: var(--n-item-text-color-active-horizontal);
 `,[S(`a`,`color: var(--n-item-text-color-active-horizontal);`),e(`extra`,`color: var(--n-item-text-color-active-horizontal);`)])]),O(`child-active`,`
 border-bottom: 2px solid var(--n-border-color-horizontal);
 `,[T(`menu-item-content-header`,`
 color: var(--n-item-text-color-child-active-horizontal);
 `,[S(`a`,`
 color: var(--n-item-text-color-child-active-horizontal);
 `),e(`extra`,`
 color: var(--n-item-text-color-child-active-horizontal);
 `)]),e(`icon`,`
 color: var(--n-item-icon-color-child-active-horizontal);
 `)]),V(`disabled`,[V(`selected, child-active`,[S(`&:focus-within`,yt)]),O(`selected`,[$(null,[e(`icon`,`color: var(--n-item-icon-color-active-hover-horizontal);`),T(`menu-item-content-header`,`
 color: var(--n-item-text-color-active-hover-horizontal);
 `,[S(`a`,`color: var(--n-item-text-color-active-hover-horizontal);`),e(`extra`,`color: var(--n-item-text-color-active-hover-horizontal);`)])])]),O(`child-active`,[$(null,[e(`icon`,`color: var(--n-item-icon-color-child-active-hover-horizontal);`),T(`menu-item-content-header`,`
 color: var(--n-item-text-color-child-active-hover-horizontal);
 `,[S(`a`,`color: var(--n-item-text-color-child-active-hover-horizontal);`),e(`extra`,`color: var(--n-item-text-color-child-active-hover-horizontal);`)])])]),$(`border-bottom: 2px solid var(--n-border-color-horizontal);`,yt)]),T(`menu-item-content-header`,[S(`a`,`color: var(--n-item-text-color-horizontal);`)])])]),V(`responsive`,[T(`menu-item-content-header`,`
 overflow: hidden;
 text-overflow: ellipsis;
 `)]),O(`collapsed`,[T(`menu-item-content`,[O(`selected`,[S(`&::before`,`
 background-color: var(--n-item-color-active-collapsed) !important;
 `)]),T(`menu-item-content-header`,`opacity: 0;`),e(`arrow`,`opacity: 0;`),e(`icon`,`color: var(--n-item-icon-color-collapsed);`)])]),T(`menu-item`,`
 height: var(--n-item-height);
 margin-top: 6px;
 position: relative;
 `),T(`menu-item-content`,`
 box-sizing: border-box;
 line-height: 1.75;
 height: 100%;
 display: grid;
 grid-template-areas: "icon content arrow";
 grid-template-columns: auto 1fr auto;
 align-items: center;
 cursor: pointer;
 position: relative;
 padding-right: 18px;
 transition:
 background-color .3s var(--n-bezier),
 padding-left .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
 `,[S(`> *`,`z-index: 1;`),S(`&::before`,`
 z-index: auto;
 content: "";
 background-color: #0000;
 position: absolute;
 left: 8px;
 right: 8px;
 top: 0;
 bottom: 0;
 pointer-events: none;
 border-radius: var(--n-border-radius);
 transition: background-color .3s var(--n-bezier);
 `),O(`disabled`,`
 opacity: .45;
 cursor: not-allowed;
 `),O(`collapsed`,[e(`arrow`,`transform: rotate(0);`)]),O(`selected`,[S(`&::before`,`background-color: var(--n-item-color-active);`),e(`arrow`,`color: var(--n-arrow-color-active);`),e(`icon`,`color: var(--n-item-icon-color-active);`),T(`menu-item-content-header`,`
 color: var(--n-item-text-color-active);
 `,[S(`a`,`color: var(--n-item-text-color-active);`),e(`extra`,`color: var(--n-item-text-color-active);`)])]),O(`child-active`,[T(`menu-item-content-header`,`
 color: var(--n-item-text-color-child-active);
 `,[S(`a`,`
 color: var(--n-item-text-color-child-active);
 `),e(`extra`,`
 color: var(--n-item-text-color-child-active);
 `)]),e(`arrow`,`
 color: var(--n-arrow-color-child-active);
 `),e(`icon`,`
 color: var(--n-item-icon-color-child-active);
 `)]),V(`disabled`,[V(`selected, child-active`,[S(`&:focus-within`,vt)]),O(`selected`,[$(null,[e(`arrow`,`color: var(--n-arrow-color-active-hover);`),e(`icon`,`color: var(--n-item-icon-color-active-hover);`),T(`menu-item-content-header`,`
 color: var(--n-item-text-color-active-hover);
 `,[S(`a`,`color: var(--n-item-text-color-active-hover);`),e(`extra`,`color: var(--n-item-text-color-active-hover);`)])])]),O(`child-active`,[$(null,[e(`arrow`,`color: var(--n-arrow-color-child-active-hover);`),e(`icon`,`color: var(--n-item-icon-color-child-active-hover);`),T(`menu-item-content-header`,`
 color: var(--n-item-text-color-child-active-hover);
 `,[S(`a`,`color: var(--n-item-text-color-child-active-hover);`),e(`extra`,`color: var(--n-item-text-color-child-active-hover);`)])])]),O(`selected`,[$(null,[S(`&::before`,`background-color: var(--n-item-color-active-hover);`)])]),$(null,vt)]),e(`icon`,`
 grid-area: icon;
 color: var(--n-item-icon-color);
 transition:
 color .3s var(--n-bezier),
 font-size .3s var(--n-bezier),
 margin-right .3s var(--n-bezier);
 box-sizing: content-box;
 display: inline-flex;
 align-items: center;
 justify-content: center;
 `),e(`arrow`,`
 grid-area: arrow;
 font-size: 16px;
 color: var(--n-arrow-color);
 transform: rotate(180deg);
 opacity: 1;
 transition:
 color .3s var(--n-bezier),
 transform 0.2s var(--n-bezier),
 opacity 0.2s var(--n-bezier);
 `),T(`menu-item-content-header`,`
 grid-area: content;
 transition:
 color .3s var(--n-bezier),
 opacity .3s var(--n-bezier);
 opacity: 1;
 white-space: nowrap;
 color: var(--n-item-text-color);
 `,[S(`a`,`
 outline: none;
 text-decoration: none;
 transition: color .3s var(--n-bezier);
 color: var(--n-item-text-color);
 `,[S(`&::before`,`
 content: "";
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 bottom: 0;
 `)]),e(`extra`,`
 font-size: .93em;
 color: var(--n-group-text-color);
 transition: color .3s var(--n-bezier);
 `)])]),T(`submenu`,`
 cursor: pointer;
 position: relative;
 margin-top: 6px;
 `,[T(`menu-item-content`,`
 height: var(--n-item-height);
 `),T(`submenu-children`,`
 overflow: hidden;
 padding: 0;
 `,[pe({duration:`.2s`})])]),T(`menu-item-group`,[T(`menu-item-group-title`,`
 margin-top: 6px;
 color: var(--n-group-text-color);
 cursor: default;
 font-size: .93em;
 height: 36px;
 display: flex;
 align-items: center;
 transition:
 padding-left .3s var(--n-bezier),
 color .3s var(--n-bezier);
 `)])]),T(`menu-tooltip`,[S(`a`,`
 color: inherit;
 text-decoration: none;
 `)]),T(`menu-divider`,`
 transition: background-color .3s var(--n-bezier);
 background-color: var(--n-divider-color);
 height: 1px;
 margin: 6px 18px;
 `)]);function $(e,t){return[O(`hover`,e,t),S(`&:hover`,e,t)]}var xt=M({name:`MenuDivider`,setup(){let{mergedClsPrefixRef:e,isHorizontalRef:t}=f(Q);return()=>t.value?null:(s(),n(`div`,{key:1,class:B(`${e.value}-menu-divider`)},null,2))}}),St=M({name:`ChevronDownFilled`,render(){return(()=>{let e=I(`f3af82a2aab086a5`);return e[0]||=E(`svg`,{viewBox:`0 0 16 16`,fill:`none`,xmlns:`http://www.w3.org/2000/svg`},[E(`path`,{d:`M3.20041 5.73966C3.48226 5.43613 3.95681 5.41856 4.26034 5.70041L8 9.22652L11.7397 5.70041C12.0432 5.41856 12.5177 5.43613 12.7996 5.73966C13.0815 6.0432 13.0639 6.51775 12.7603 6.7996L8.51034 10.7996C8.22258 11.0668 7.77743 11.0668 7.48967 10.7996L3.23966 6.7996C2.93613 6.51775 2.91856 6.0432 3.20041 5.73966Z`,fill:`currentColor`})],-1)})()}}),Ct=[`onClick`],wt=M({name:`MenuOptionContent`,props:{collapsed:Boolean,disabled:Boolean,title:[String,Function],icon:Function,extra:[String,Function],showArrow:Boolean,childActive:Boolean,hover:Boolean,paddingLeft:Number,selected:Boolean,maxIconSize:{type:Number,required:!0},activeIconSize:{type:Number,required:!0},iconMarginRight:{type:Number,required:!0},clsPrefix:{type:String,required:!0},onClick:Function,tmNode:{type:Object,required:!0},isEllipsisPlaceholder:Boolean},setup(e){let{props:t}=f(Q);return{menuProps:t,style:K(()=>{let{paddingLeft:t}=e;return{paddingLeft:t&&`${t}px`}}),iconStyle:K(()=>{let{maxIconSize:t,activeIconSize:n,iconMarginRight:r}=e;return{width:`${t}px`,height:`${t}px`,fontSize:`${n}px`,marginRight:`${r}px`}})}},render(){let{clsPrefix:e,tmNode:t,menuProps:{renderIcon:r,renderLabel:i,renderExtra:o,expandIcon:c}}=this,l=r?r(t.rawNode):J(this.icon);return(()=>{let r=I(`7bb10afc6caf8fa4`);return s(),n(`div`,{onClick:e=>{this.onClick?.(e)},role:`none`,class:B([`${e}-menu-item-content`,{[`${e}-menu-item-content--selected`]:this.selected,[`${e}-menu-item-content--collapsed`]:this.collapsed,[`${e}-menu-item-content--child-active`]:this.childActive,[`${e}-menu-item-content--disabled`]:this.disabled,[`${e}-menu-item-content--hover`]:this.hover}]),style:N(this.style)},[U(()=>l&&(s(),n(`div`,{class:B(`${e}-menu-item-content__icon`),style:N(this.iconStyle),role:`none`},[U(()=>[l])],6))),E(`div`,{class:B(`${e}-menu-item-content-header`),role:`none`},[this.isEllipsisPlaceholder?(s(),n(k,{key:0},[U(()=>this.title)],64)):(s(),n(k,{key:1},[i?(s(),n(k,{key:0},[U(()=>i(t.rawNode))],64)):(s(),n(k,{key:1},[U(()=>J(this.title))],64))],64)),this.extra||o?(s(),n(`span`,{key:2,class:B(`${e}-menu-item-content-header__extra`)},[r[0]||=U(` `,-1),o?(s(),n(k,{key:0},[U(()=>o(t.rawNode))],64)):(s(),n(k,{key:1},[U(()=>J(this.extra))],64))],2)):U(()=>null)],2),this.showArrow?(s(),G(a,{key:0,ariaHidden:!0,class:B(`${e}-menu-item-content__arrow`),clsPrefix:e},{default:()=>c?c(t.rawNode):(s(),G(St,{key:1}))},1032,[`class`,`clsPrefix`])):U(()=>null)],14,Ct)})()}}),Tt=8;function Et(e){let t=f(Q),{props:n,mergedCollapsedRef:r}=t,i=f(gt,null),a=f(_t,null),o=K(()=>n.mode===`horizontal`),s=K(()=>o.value?n.dropdownPlacement:`tmNodes`in e?`right-start`:`right`),c=K(()=>Math.max(n.collapsedIconSize??n.iconSize,n.iconSize));return{dropdownPlacement:s,activeIconSize:K(()=>!o.value&&e.root&&r.value?n.collapsedIconSize??n.iconSize:n.iconSize),maxIconSize:c,paddingLeft:K(()=>{if(o.value)return;let{collapsedWidth:t,indent:s,rootIndent:l}=n,{root:u,isGroup:d}=e,f=l===void 0?s:l;return u?r.value?t/2-c.value/2:f:a&&typeof a.paddingLeftRef.value==`number`?r.value?t/2-c.value/2:s/2+a.paddingLeftRef.value:i&&typeof i.paddingLeftRef.value==`number`?(d?s/2:s)+i.paddingLeftRef.value:0}),iconMarginRight:K(()=>{let{collapsedWidth:t,indent:i,rootIndent:a}=n,{value:s}=c,{root:l}=e;return o.value||!l||!r.value?Tt:(a===void 0?i:a)+s+Tt-(t+s)/2}),NMenu:t,NSubmenu:i,NMenuOptionGroup:a}}var Dt={internalKey:{type:[String,Number],required:!0},root:Boolean,isGroup:Boolean,level:{type:Number,required:!0},title:[String,Function],extra:[String,Function]},Ot={...Dt,tmNode:{type:Object,required:!0},disabled:Boolean,icon:Function,onClick:Function},kt=le(Ot),At=M({name:`MenuOption`,props:Ot,setup(e){let t=Et(e),{NSubmenu:n,NMenu:r,NMenuOptionGroup:i}=t,{props:a,mergedClsPrefixRef:o,mergedCollapsedRef:s}=r,c=n?n.mergedDisabledRef:i?i.mergedDisabledRef:{value:!1},l=K(()=>c.value||e.disabled);function u(t){let{onClick:n}=e;n&&n(t)}function d(t){l.value||(r.doSelect(e.internalKey,e.tmNode.rawNode),u(t))}return{mergedClsPrefix:o,dropdownPlacement:t.dropdownPlacement,paddingLeft:t.paddingLeft,iconMarginRight:t.iconMarginRight,maxIconSize:t.maxIconSize,activeIconSize:t.activeIconSize,mergedTheme:r.mergedThemeRef,menuProps:a,dropdownEnabled:p(()=>e.root&&s.value&&a.mode!==`horizontal`&&!l.value),selected:p(()=>r.mergedValueRef.value===e.internalKey),mergedDisabled:l,handleClick:d}},render(){let{mergedClsPrefix:e,mergedTheme:t,tmNode:r,menuProps:{renderLabel:i,nodeProps:a}}=this,o=a?.(r.rawNode);return s(),n(`div`,m(o,{role:`menuitem`,class:[`${e}-menu-item`,o?.class]}),[(s(),G(Se,{theme:t.peers.Tooltip,themeOverrides:t.peerOverrides.Tooltip,trigger:`hover`,placement:this.dropdownPlacement,disabled:!this.dropdownEnabled||this.title===void 0,internalExtraClass:[`menu-tooltip`]},{default:()=>i?i(r.rawNode):J(this.title),trigger:()=>(s(),G(wt,{tmNode:r,clsPrefix:e,paddingLeft:this.paddingLeft,iconMarginRight:this.iconMarginRight,maxIconSize:this.maxIconSize,activeIconSize:this.activeIconSize,selected:this.selected,title:this.title,extra:this.extra,disabled:this.mergedDisabled,icon:this.icon,onClick:this.handleClick},null,8,[`tmNode`,`clsPrefix`,`paddingLeft`,`iconMarginRight`,`maxIconSize`,`activeIconSize`,`selected`,`title`,`extra`,`disabled`,`icon`,`onClick`]))},1032,[`theme`,`themeOverrides`,`placement`,`disabled`]))],16)}}),jt={...Dt,tmNode:{type:Object,required:!0},tmNodes:{type:Array,required:!0}},Mt=le(jt),Nt=M({name:`MenuOptionGroup`,props:jt,setup(e){let t=Et(e),{NSubmenu:r}=t,i=K(()=>r?.mergedDisabledRef.value?!0:e.tmNode.disabled);v(_t,{paddingLeftRef:t.paddingLeft,mergedDisabledRef:i});let{mergedClsPrefixRef:a,props:o}=f(Q);return function(){let{value:r}=a,i=t.paddingLeft.value,{nodeProps:c}=o,l=c?.(e.tmNode.rawNode);return(()=>{let t=I(`45eca6a63be5028b`);return s(),n(`div`,{class:B(`${r}-menu-item-group`),role:`group`},[E(`div`,m(l,{class:[`${r}-menu-item-group-title`,l?.class],style:[l?.style||``,i===void 0?``:`padding-left: ${i}px;`]}),[U(()=>J(e.title)),e.extra?(s(),n(k,{key:0},[t[0]||=U(` `,-1),U(()=>J(e.extra))],64)):U(()=>null)],16),E(`div`,null,[U(()=>e.tmNodes.map(e=>Vt(e,o)))])],2)})()}}}),Pt=[`aria-expanded`,`id`],Ft=[`aria-expanded`,`id`],It={...Dt,rawNodes:{type:Array,default:()=>[]},tmNodes:{type:Array,default:()=>[]},tmNode:{type:Object,required:!0},disabled:Boolean,icon:Function,onClick:Function,domId:String,virtualChildActive:{type:Boolean,default:void 0},isEllipsisPlaceholder:Boolean},Lt=le(It),Rt=M({name:`Submenu`,props:It,setup(e){let t=Et(e),{NMenu:n,NSubmenu:r}=t,{props:i,mergedCollapsedRef:a,mergedThemeRef:o}=n,s=K(()=>{let{disabled:t}=e;return r?.mergedDisabledRef.value||i.disabled?!0:t}),c=R(!1);v(gt,{paddingLeftRef:t.paddingLeft,mergedDisabledRef:s}),v(_t,null);function l(){let{onClick:t}=e;t&&t()}function u(){s.value||(a.value||n.toggleExpand(e.internalKey),l())}function d(e){c.value=e}return{menuProps:i,mergedTheme:o,doSelect:n.doSelect,inverted:n.invertedRef,isHorizontal:n.isHorizontalRef,mergedClsPrefix:n.mergedClsPrefixRef,maxIconSize:t.maxIconSize,activeIconSize:t.activeIconSize,iconMarginRight:t.iconMarginRight,dropdownPlacement:t.dropdownPlacement,dropdownShow:c,paddingLeft:t.paddingLeft,mergedDisabled:s,mergedValue:n.mergedValueRef,childActive:p(()=>e.virtualChildActive??n.activePathRef.value.includes(e.internalKey)),collapsed:K(()=>i.mode===`horizontal`?!1:a.value?!0:!n.mergedExpandedKeysRef.value.includes(e.internalKey)),dropdownEnabled:K(()=>!s.value&&(i.mode===`horizontal`||a.value)),handlePopoverShowChange:d,handleClick:u}},render(){let{mergedClsPrefix:e,menuProps:{renderIcon:t,renderLabel:r}}=this,i=()=>{let{isHorizontal:e,paddingLeft:t,collapsed:r,mergedDisabled:i,maxIconSize:a,activeIconSize:o,title:c,childActive:l,icon:u,handleClick:d,menuProps:{nodeProps:f},dropdownShow:p,iconMarginRight:h,tmNode:g,mergedClsPrefix:_,isEllipsisPlaceholder:v,extra:y}=this,b=f?.(g.rawNode);return s(),n(`div`,m(b,{class:[`${_}-menu-item`,b?.class],role:`menuitem`}),[(s(),G(wt,{tmNode:g,paddingLeft:t,collapsed:r,disabled:i,iconMarginRight:h,maxIconSize:a,activeIconSize:o,title:c,extra:y,showArrow:!e,childActive:l,clsPrefix:_,icon:u,hover:p,onClick:d,isEllipsisPlaceholder:v},null,8,[`tmNode`,`paddingLeft`,`collapsed`,`disabled`,`iconMarginRight`,`maxIconSize`,`activeIconSize`,`title`,`extra`,`showArrow`,`childActive`,`clsPrefix`,`icon`,`hover`,`onClick`,`isEllipsisPlaceholder`]))],16)},a=()=>(s(),G(te,null,{default:()=>{let{tmNodes:t,collapsed:r}=this;return r?null:(s(),n(`div`,{key:1,class:B(`${e}-submenu-children`),role:`menu`},[U(()=>t.map(e=>Vt(e,this.menuProps)))],2))}},1024));return this.root?(s(),G(we,m({key:2,size:`large`,trigger:`hover`},this.menuProps?.dropdownProps,{themeOverrides:this.mergedTheme.peerOverrides.Dropdown,theme:this.mergedTheme.peers.Dropdown,builtinThemeOverrides:{fontSizeLarge:`14px`,optionIconSizeLarge:`18px`},value:this.mergedValue,disabled:!this.dropdownEnabled,placement:this.dropdownPlacement,keyField:this.menuProps.keyField,labelField:this.menuProps.labelField,childrenField:this.menuProps.childrenField,onUpdateShow:this.handlePopoverShowChange,options:this.rawNodes,onSelect:this.doSelect,inverted:this.inverted,renderIcon:t,renderLabel:r}),{default:()=>(s(),n(`div`,{class:B(`${e}-submenu`),role:`menu`,"aria-expanded":!this.collapsed,id:this.domId},[U(()=>i()),this.isHorizontal?U(()=>null):(s(),n(k,{key:1},[U(()=>a())],64))],10,Pt))},1040,[`themeOverrides`,`theme`,`value`,`disabled`,`placement`,`keyField`,`labelField`,`childrenField`,`onUpdateShow`,`options`,`onSelect`,`inverted`,`renderIcon`,`renderLabel`])):(s(),n(`div`,{key:3,class:B(`${e}-submenu`),role:`menu`,"aria-expanded":!this.collapsed,id:this.domId},[U(()=>i()),U(()=>a())],10,Ft))}});function zt(e){return e.type===`divider`||e.type===`render`}function Bt(e){return e.type===`divider`}function Vt(e,t){let{rawNode:n}=e,{show:r}=n;if(r===!1)return null;if(zt(n))return Bt(n)?(s(),G(xt,m({key:e.key},n.props),null,16)):null;let{labelField:i}=t,{key:a,level:o,isGroup:c}=e,l={...n,title:n.title||n[i],extra:n.titleExtra||n.extra,key:a,internalKey:a,level:o,root:o===0,isGroup:c};return e.children?e.isGroup?j(Nt,_e(l,Mt,{tmNode:e,tmNodes:e.children,key:a})):j(Rt,_e(l,Lt,{key:a,rawNodes:n[t.childrenField],tmNodes:e.children,tmNode:e})):j(At,_e(l,kt,{key:a,tmNode:e}))}var Ht={...u.props,options:{type:Array,default:()=>[]},collapsed:{type:Boolean,default:void 0},collapsedWidth:{type:Number,default:48},iconSize:{type:Number,default:20},collapsedIconSize:{type:Number,default:24},rootIndent:Number,indent:{type:Number,default:32},labelField:{type:String,default:`label`},keyField:{type:String,default:`key`},childrenField:{type:String,default:`children`},disabledField:{type:String,default:`disabled`},defaultExpandAll:Boolean,defaultExpandedKeys:Array,expandedKeys:Array,value:[String,Number],defaultValue:{type:[String,Number],default:null},mode:{type:String,default:`vertical`},watchProps:{type:Array,default:void 0},disabled:Boolean,show:{type:Boolean,default:!0},inverted:Boolean,"onUpdate:expandedKeys":[Function,Array],onUpdateExpandedKeys:[Function,Array],onUpdateValue:[Function,Array],"onUpdate:value":[Function,Array],expandIcon:Function,renderIcon:Function,renderLabel:Function,renderExtra:Function,dropdownProps:Object,accordion:Boolean,nodeProps:Function,dropdownPlacement:{type:String,default:`bottom`},responsive:Boolean,items:Array,onOpenNamesChange:[Function,Array],onSelect:[Function,Array],onExpandedNamesChange:[Function,Array],expandedNames:Array,defaultExpandedNames:Array},Ut=M({name:`Menu`,inheritAttrs:!1,props:Ht,setup(e){let{mergedClsPrefixRef:t,inlineThemeDisabled:n}=A(e),r=u(`Menu`,`-menu`,bt,ue,e,t),i=f(Ze,null),a=K(()=>{let{collapsed:t}=e;if(t!==void 0)return t;if(i){let{collapseModeRef:e,collapsedRef:t}=i;if(e.value===`width`)return t.value??!1}return!1}),o=K(()=>{let{keyField:t,childrenField:n,disabledField:r}=e;return xe(e.items||e.options,{getIgnored(e){return zt(e)},getChildren(e){return e[n]},getDisabled(e){return e[r]},getKey(e){return e[t]??e.name}})}),c=K(()=>new Set(o.value.treeNodes.map(e=>e.key))),{watchProps:l}=e,p=R(null);l?.includes(`defaultValue`)?x(()=>{p.value=e.defaultValue}):p.value=e.defaultValue;let m=F(e,`value`),g=ie(m,p),_=R([]),y=()=>{_.value=e.defaultExpandAll?o.value.getNonLeafKeys():e.defaultExpandedNames||e.defaultExpandedKeys||o.value.getPath(g.value,{includeSelf:!1}).keyPath};l?.includes(`defaultExpandedKeys`)?x(y):y();let b=Ce(e,[`expandedNames`,`expandedKeys`]),S=ie(b,_),C=K(()=>o.value.treeNodes),w=K(()=>o.value.getPath(g.value).keyPath);v(Q,{props:e,mergedCollapsedRef:a,mergedThemeRef:r,mergedValueRef:g,mergedExpandedKeysRef:S,activePathRef:w,mergedClsPrefixRef:t,isHorizontalRef:K(()=>e.mode===`horizontal`),invertedRef:F(e,`inverted`),doSelect:T,toggleExpand:D});function T(t,n){let{"onUpdate:value":r,onUpdateValue:i,onSelect:a}=e;i&&d(i,t,n),r&&d(r,t,n),a&&d(a,t,n),p.value=t}function E(t){let{"onUpdate:expandedKeys":n,onUpdateExpandedKeys:r,onExpandedNamesChange:i,onOpenNamesChange:a}=e;n&&d(n,t),r&&d(r,t),i&&d(i,t),a&&d(a,t),_.value=t}function D(t){let n=Array.from(S.value),r=n.findIndex(e=>e===t);if(~r)n.splice(r,1);else{if(e.accordion&&c.value.has(t)){let e=n.findIndex(e=>c.value.has(e));e>-1&&n.splice(e,1)}n.push(t)}E(n)}let O=t=>{let n=o.value.getPath(t??g.value,{includeSelf:!1}).keyPath;if(!n.length)return;let r=Array.from(S.value),i=new Set([...r,...n]);e.accordion&&c.value.forEach(e=>{i.has(e)&&!n.includes(e)&&i.delete(e)}),E(Array.from(i))},k=K(()=>{let{inverted:t}=e,{common:{cubicBezierEaseInOut:n},self:i}=r.value,{borderRadius:a,borderColorHorizontal:o,fontSize:s,itemHeight:c,dividerColor:l}=i,u={"--n-divider-color":l,"--n-bezier":n,"--n-font-size":s,"--n-border-color-horizontal":o,"--n-border-radius":a,"--n-item-height":c};return t?(u[`--n-group-text-color`]=i.groupTextColorInverted,u[`--n-color`]=i.colorInverted,u[`--n-item-text-color`]=i.itemTextColorInverted,u[`--n-item-text-color-hover`]=i.itemTextColorHoverInverted,u[`--n-item-text-color-active`]=i.itemTextColorActiveInverted,u[`--n-item-text-color-child-active`]=i.itemTextColorChildActiveInverted,u[`--n-item-text-color-child-active-hover`]=i.itemTextColorChildActiveInverted,u[`--n-item-text-color-active-hover`]=i.itemTextColorActiveHoverInverted,u[`--n-item-icon-color`]=i.itemIconColorInverted,u[`--n-item-icon-color-hover`]=i.itemIconColorHoverInverted,u[`--n-item-icon-color-active`]=i.itemIconColorActiveInverted,u[`--n-item-icon-color-active-hover`]=i.itemIconColorActiveHoverInverted,u[`--n-item-icon-color-child-active`]=i.itemIconColorChildActiveInverted,u[`--n-item-icon-color-child-active-hover`]=i.itemIconColorChildActiveHoverInverted,u[`--n-item-icon-color-collapsed`]=i.itemIconColorCollapsedInverted,u[`--n-item-text-color-horizontal`]=i.itemTextColorHorizontalInverted,u[`--n-item-text-color-hover-horizontal`]=i.itemTextColorHoverHorizontalInverted,u[`--n-item-text-color-active-horizontal`]=i.itemTextColorActiveHorizontalInverted,u[`--n-item-text-color-child-active-horizontal`]=i.itemTextColorChildActiveHorizontalInverted,u[`--n-item-text-color-child-active-hover-horizontal`]=i.itemTextColorChildActiveHoverHorizontalInverted,u[`--n-item-text-color-active-hover-horizontal`]=i.itemTextColorActiveHoverHorizontalInverted,u[`--n-item-icon-color-horizontal`]=i.itemIconColorHorizontalInverted,u[`--n-item-icon-color-hover-horizontal`]=i.itemIconColorHoverHorizontalInverted,u[`--n-item-icon-color-active-horizontal`]=i.itemIconColorActiveHorizontalInverted,u[`--n-item-icon-color-active-hover-horizontal`]=i.itemIconColorActiveHoverHorizontalInverted,u[`--n-item-icon-color-child-active-horizontal`]=i.itemIconColorChildActiveHorizontalInverted,u[`--n-item-icon-color-child-active-hover-horizontal`]=i.itemIconColorChildActiveHoverHorizontalInverted,u[`--n-arrow-color`]=i.arrowColorInverted,u[`--n-arrow-color-hover`]=i.arrowColorHoverInverted,u[`--n-arrow-color-active`]=i.arrowColorActiveInverted,u[`--n-arrow-color-active-hover`]=i.arrowColorActiveHoverInverted,u[`--n-arrow-color-child-active`]=i.arrowColorChildActiveInverted,u[`--n-arrow-color-child-active-hover`]=i.arrowColorChildActiveHoverInverted,u[`--n-item-color-hover`]=i.itemColorHoverInverted,u[`--n-item-color-active`]=i.itemColorActiveInverted,u[`--n-item-color-active-hover`]=i.itemColorActiveHoverInverted,u[`--n-item-color-active-collapsed`]=i.itemColorActiveCollapsedInverted):(u[`--n-group-text-color`]=i.groupTextColor,u[`--n-color`]=i.color,u[`--n-item-text-color`]=i.itemTextColor,u[`--n-item-text-color-hover`]=i.itemTextColorHover,u[`--n-item-text-color-active`]=i.itemTextColorActive,u[`--n-item-text-color-child-active`]=i.itemTextColorChildActive,u[`--n-item-text-color-child-active-hover`]=i.itemTextColorChildActiveHover,u[`--n-item-text-color-active-hover`]=i.itemTextColorActiveHover,u[`--n-item-icon-color`]=i.itemIconColor,u[`--n-item-icon-color-hover`]=i.itemIconColorHover,u[`--n-item-icon-color-active`]=i.itemIconColorActive,u[`--n-item-icon-color-active-hover`]=i.itemIconColorActiveHover,u[`--n-item-icon-color-child-active`]=i.itemIconColorChildActive,u[`--n-item-icon-color-child-active-hover`]=i.itemIconColorChildActiveHover,u[`--n-item-icon-color-collapsed`]=i.itemIconColorCollapsed,u[`--n-item-text-color-horizontal`]=i.itemTextColorHorizontal,u[`--n-item-text-color-hover-horizontal`]=i.itemTextColorHoverHorizontal,u[`--n-item-text-color-active-horizontal`]=i.itemTextColorActiveHorizontal,u[`--n-item-text-color-child-active-horizontal`]=i.itemTextColorChildActiveHorizontal,u[`--n-item-text-color-child-active-hover-horizontal`]=i.itemTextColorChildActiveHoverHorizontal,u[`--n-item-text-color-active-hover-horizontal`]=i.itemTextColorActiveHoverHorizontal,u[`--n-item-icon-color-horizontal`]=i.itemIconColorHorizontal,u[`--n-item-icon-color-hover-horizontal`]=i.itemIconColorHoverHorizontal,u[`--n-item-icon-color-active-horizontal`]=i.itemIconColorActiveHorizontal,u[`--n-item-icon-color-active-hover-horizontal`]=i.itemIconColorActiveHoverHorizontal,u[`--n-item-icon-color-child-active-horizontal`]=i.itemIconColorChildActiveHorizontal,u[`--n-item-icon-color-child-active-hover-horizontal`]=i.itemIconColorChildActiveHoverHorizontal,u[`--n-arrow-color`]=i.arrowColor,u[`--n-arrow-color-hover`]=i.arrowColorHover,u[`--n-arrow-color-active`]=i.arrowColorActive,u[`--n-arrow-color-active-hover`]=i.arrowColorActiveHover,u[`--n-arrow-color-child-active`]=i.arrowColorChildActive,u[`--n-arrow-color-child-active-hover`]=i.arrowColorChildActiveHover,u[`--n-item-color-hover`]=i.itemColorHover,u[`--n-item-color-active`]=i.itemColorActive,u[`--n-item-color-active-hover`]=i.itemColorActiveHover,u[`--n-item-color-active-collapsed`]=i.itemColorActiveCollapsed),u}),j=n?h(`menu`,K(()=>e.inverted?`a`:`b`),k,e):void 0,M=ce(),N=R(null),P=R(null),I=!0,ee=()=>{I?I=!1:N.value?.sync({showAllItemsBeforeCalculate:!0})};function L(){return document.getElementById(M)}let z=R(-1);function B(t){z.value=e.options.length-t}function V(e){e||(z.value=-1)}let H=K(()=>{let t=z.value;return{children:t===-1?[]:e.options.slice(t)}}),U=K(()=>{let{childrenField:t,disabledField:n,keyField:r}=e;return xe([H.value],{getIgnored(e){return zt(e)},getChildren(e){return e[t]},getDisabled(e){return e[n]},getKey(e){return e[r]??e.name}})}),te=K(()=>xe([{}]).treeNodes[0]);function W(){if(z.value===-1)return s(),G(Rt,{root:!0,level:0,key:`__ellpisisGroupPlaceholder__`,internalKey:`__ellpisisGroupPlaceholder__`,title:`···`,tmNode:te.value,domId:M,isEllipsisPlaceholder:!0},null,8,[`tmNode`,`domId`]);let e=U.value.treeNodes[0],t=w.value,n=!!e.children?.some(e=>t.includes(e.key));return s(),G(Rt,{level:0,root:!0,key:`__ellpisisGroup__`,internalKey:`__ellpisisGroup__`,title:`···`,virtualChildActive:n,tmNode:e,domId:M,rawNodes:e.rawNode.children||[],tmNodes:e.children||[],isEllipsisPlaceholder:!0},null,8,[`virtualChildActive`,`tmNode`,`domId`,`rawNodes`,`tmNodes`])}return{mergedClsPrefix:t,controlledExpandedKeys:b,uncontrolledExpanededKeys:_,mergedExpandedKeys:S,uncontrolledValue:p,mergedValue:g,activePath:w,tmNodes:C,mergedTheme:r,mergedCollapsed:a,cssVars:n?void 0:k,themeClass:j?.themeClass,overflowRef:N,counterRef:P,updateCounter:()=>{},onResize:ee,onUpdateOverflow:V,onUpdateCount:B,renderCounter:W,getCounter:L,onRender:j?.onRender,showOption:O,deriveResponsiveState:ee}},render(){let{mergedClsPrefix:e,mode:t,themeClass:n,onRender:r}=this;r?.();let i=()=>this.tmNodes.map(e=>Vt(e,this.$props)),a=t===`horizontal`&&this.responsive,o=()=>j(`div`,m(this.$attrs,{role:t===`horizontal`?`menubar`:`menu`,class:[`${e}-menu`,n,`${e}-menu--${t}`,a&&`${e}-menu--responsive`,this.mergedCollapsed&&`${e}-menu--collapsed`],style:this.cssVars}),a?(s(),G(ye,{key:2,ref:`overflowRef`,onUpdateOverflow:this.onUpdateOverflow,getCounter:this.getCounter,onUpdateCount:this.onUpdateCount,updateCounter:this.updateCounter,style:{width:`100%`,display:`flex`,overflow:`hidden`}},{default:i,counter:this.renderCounter},1032,[`onUpdateOverflow`,`getCounter`,`onUpdateCount`,`updateCounter`])):i());return a?(s(),G(fe,{key:3,onResize:this.onResize},{default:o},1032,[`onResize`])):o()}}),Wt={xmlns:`http://www.w3.org/2000/svg`,"xmlns:xlink":`http://www.w3.org/1999/xlink`,viewBox:`0 0 512 512`},Gt=M({name:`LogOutOutline`,render:function(e,t){return s(),n(`svg`,Wt,t[0]||=[E(`path`,{d:`M304 336v40a40 40 0 0 1-40 40H104a40 40 0 0 1-40-40V136a40 40 0 0 1 40-40h152c22.09 0 48 17.91 48 40v40`,fill:`none`,stroke:`currentColor`,"stroke-linecap":`round`,"stroke-linejoin":`round`,"stroke-width":`32`},null,-1),E(`path`,{fill:`none`,stroke:`currentColor`,"stroke-linecap":`round`,"stroke-linejoin":`round`,"stroke-width":`32`,d:`M368 336l80-80l-80-80`},null,-1),E(`path`,{fill:`none`,stroke:`currentColor`,"stroke-linecap":`round`,"stroke-linejoin":`round`,"stroke-width":`32`,d:`M176 256h256`},null,-1)])}}),Kt={xmlns:`http://www.w3.org/2000/svg`,"xmlns:xlink":`http://www.w3.org/1999/xlink`,viewBox:`0 0 512 512`},qt=M({name:`MenuOutline`,render:function(e,t){return s(),n(`svg`,Kt,t[0]||=[E(`path`,{fill:`none`,stroke:`currentColor`,"stroke-linecap":`round`,"stroke-miterlimit":`10`,"stroke-width":`32`,d:`M80 160h352`},null,-1),E(`path`,{fill:`none`,stroke:`currentColor`,"stroke-linecap":`round`,"stroke-miterlimit":`10`,"stroke-width":`32`,d:`M80 256h352`},null,-1),E(`path`,{fill:`none`,stroke:`currentColor`,"stroke-linecap":`round`,"stroke-miterlimit":`10`,"stroke-width":`32`,d:`M80 352h352`},null,-1)])}}),Jt={xmlns:`http://www.w3.org/2000/svg`,"xmlns:xlink":`http://www.w3.org/1999/xlink`,viewBox:`0 0 512 512`},Yt=M({name:`ReturnDownBackOutline`,render:function(e,t){return s(),n(`svg`,Jt,t[0]||=[E(`path`,{fill:`none`,stroke:`currentColor`,"stroke-linecap":`round`,"stroke-linejoin":`round`,"stroke-width":`32`,d:`M112 352l-64-64l64-64`},null,-1),E(`path`,{d:`M64 288h294c58.76 0 106-49.33 106-108v-20`,fill:`none`,stroke:`currentColor`,"stroke-linecap":`round`,"stroke-linejoin":`round`,"stroke-width":`32`},null,-1)])}}),Xt={xmlns:`http://www.w3.org/2000/svg`,"xmlns:xlink":`http://www.w3.org/1999/xlink`,viewBox:`0 0 512 512`},Zt=M({name:`SwapHorizontalOutline`,render:function(e,t){return s(),n(`svg`,Xt,t[0]||=[E(`path`,{fill:`none`,stroke:`currentColor`,"stroke-linecap":`round`,"stroke-linejoin":`round`,"stroke-width":`32`,d:`M304 48l112 112l-112 112`},null,-1),E(`path`,{fill:`none`,stroke:`currentColor`,"stroke-linecap":`round`,"stroke-linejoin":`round`,"stroke-width":`32`,d:`M398.87 160H96`},null,-1),E(`path`,{fill:`none`,stroke:`currentColor`,"stroke-linecap":`round`,"stroke-linejoin":`round`,"stroke-width":`32`,d:`M208 464L96 352l112-112`},null,-1),E(`path`,{fill:`none`,stroke:`currentColor`,"stroke-linecap":`round`,"stroke-linejoin":`round`,"stroke-width":`32`,d:`M114 352h302`},null,-1)])}}),Qt=[{key:`dashboard`,title:`仪表盘`,icon:Ve,path:`/dashboard`},{key:`system-management`,title:`系统管理`,icon:We,children:[{path:`/config/system`,title:`系统配置`},{path:`/config/plugin`,title:`插件管理`},{path:`/config/theme`,title:`主题配置`},{path:`/config/notice`,title:`公告管理`},{path:`/config/payment`,title:`支付配置`},{path:`/config/knowledge`,title:`知识库管理`},{path:`/config/system-status`,title:`系统状态`},{path:`/config/audit-log`,title:`审计日志`}]},{key:`node-management`,title:`节点管理`,icon:Je,children:[{path:`/server/machine`,title:`服务器管理`},{path:`/server/manage`,title:`节点管理`},{path:`/server/group`,title:`权限组管理`},{path:`/server/route`,title:`路由管理`}]},{key:`subscription-management`,title:`订阅管理`,icon:Fe,children:[{path:`/finance/plan`,title:`套餐管理`},{path:`/finance/order`,title:`订单管理`},{path:`/finance/coupon`,title:`优惠券管理`},{path:`/finance/gift-card`,title:`礼品卡管理`}]},{key:`user-management`,title:`用户管理`,icon:Ke,children:[{path:`/user/manage`,title:`用户管理`},{path:`/user/ticket`,title:`工单管理`},{path:`/user/traffic-reset-logs`,title:`流量重置日志`}]}];function $t(e,t){let n;for(let r of t)(e===r||e.startsWith(r+`/`))&&(!n||r.length>n.length)&&(n=r);return n}var en={class:`palette`,role:`dialog`,"aria-label":`搜索菜单`},tn={key:0,class:`palette-list`},nn=[`onMouseenter`,`onClick`],rn={class:`palette-title`},an={key:0,class:`palette-parent`},on=ae(M({__name:`CommandPalette`,props:{show:{type:Boolean},items:{}},emits:[`update:show`],setup(e,{emit:t}){let i=e,a=t,c=je(),l=R(``),u=R(0),d=R(null),f=K(()=>{let e=l.value.trim().toLowerCase();if(!e)return i.items;let t=e.split(/\s+/);return i.items.filter(e=>{let n=`${e.parent??``} ${e.title} ${e.path}`.toLowerCase();return t.every(e=>n.includes(e))})});C(()=>i.show,async e=>{e&&(l.value=``,u.value=0,await o(),d.value?.focus())}),C(l,()=>u.value=0);function p(e){e&&(a(`update:show`,!1),c.push(e.path))}function m(e){e.key===`ArrowDown`?(e.preventDefault(),u.value=Math.min(u.value+1,f.value.length-1)):e.key===`ArrowUp`?(e.preventDefault(),u.value=Math.max(u.value-1,0)):e.key===`Enter`&&(e.preventDefault(),p(f.value[u.value]))}return(t,i)=>(s(),G(z(oe),{show:e.show,"auto-focus":!1,"transform-origin":`center`,"onUpdate:show":i[1]||=e=>a(`update:show`,e)},{default:w(()=>[E(`div`,en,[r(z(Ee),{ref_key:`inputRef`,ref:d,value:l.value,"onUpdate:value":i[0]||=e=>l.value=e,placeholder:`搜索菜单和功能...`,size:`large`,clearable:``,onKeydown:m},{prefix:w(()=>[r(z(q),null,{default:w(()=>[r(z(qe))]),_:1})]),_:1},8,[`value`]),i[2]||=E(`div`,{class:`palette-group`},`菜单导航`,-1),f.value.length?(s(),n(`ul`,tn,[(s(!0),n(k,null,b(f.value,(e,t)=>(s(),n(`li`,{key:e.path,class:D([`palette-item`,{active:t===u.value}]),onMouseenter:e=>u.value=t,onClick:t=>p(e)},[E(`span`,rn,H(e.title),1),e.parent?(s(),n(`span`,an,H(e.parent),1)):_(``,!0),t===u.value?(s(),G(z(q),{key:1,class:`palette-enter`},{default:w(()=>[r(z(Yt))]),_:1})):_(``,!0)],42,nn))),128))])):(s(),G(z(ve),{key:1,description:`未找到结果`,style:{padding:`24px 0`}}))])]),_:1},8,[`show`]))}}),[[`__scopeId`,`data-v-70690d50`]]),sn=[`src`],cn={key:1,class:`brand-mark`},ln={key:2,class:`brand-title`},un={key:0,class:`sider-version`},dn={class:`brand`},fn=[`src`],pn={key:1,class:`brand-mark`},mn={class:`brand-title`},hn={class:`header-left`},gn={class:`crumbs`,"aria-label":`breadcrumb`},_n={key:0,class:`crumb-sep`},vn={class:`header-right`},yn={class:`user-chip`,type:`button`},bn={key:2,class:`user-email`},xn=ae(M({__name:`AdminLayout`,setup(e){let a=Pe(),o=je(),c=R(!1),u=R(!1),d=e=>()=>j(q,null,{default:()=>j(e)}),f=(e,t,n)=>()=>j(Ne,{to:e},{default:()=>n?[t,j(be,{size:`tiny`,bordered:!1,style:`margin-left:6px`},{default:()=>n})]:t}),p=K(()=>Ge(He.list)),m=K(()=>[...Qt.map(e=>e.path?{key:e.path,label:f(e.path,e.title),icon:d(e.icon)}:{key:e.key,label:e.title,icon:d(e.icon),children:(e.children||[]).map(e=>({key:e.path,label:f(e.path,e.title)}))}),...p.value.map(e=>({key:e.key,label:()=>[e.title,j(be,{size:`tiny`,bordered:!1,style:`margin-left:6px`},{default:()=>e.badge})],icon:d(e.icon),children:e.items.map(e=>({key:e.key,label:f(e.href,e.title,e.label),icon:d(e.icon)}))}))]),h=K(()=>{let e=[];for(let t of Qt){t.path&&e.push({key:t.path,path:t.path,title:t.title});for(let n of t.children||[])e.push({key:n.path,path:n.path,title:n.title,parent:t.title})}for(let t of p.value)for(let n of t.items)e.push({key:n.key,path:n.href,title:n.title,parent:t.title});return e}),v=K(()=>h.value),y=K(()=>a.meta.reuse?a.matched[a.matched.length-1]?.path??a.path:a.path),x=K(()=>{let e=$t(a.path,h.value.map(e=>e.path));return e?h.value.find(t=>t.path===e):void 0}),S=K(()=>x.value?.key??a.path),T=R(Qt.filter(e=>!e.path).map(e=>e.key));C(p,e=>{for(let t of e)T.value.includes(t.key)||T.value.push(t.key)});let O=K(()=>{let e=x.value,t=a.meta.title||``;if(!e)return[t];let n=e.parent?[e.parent,e.title]:[e.title];return t&&t!==e.title&&a.path!==e.path&&n.push(t),n}),A=K(()=>Y.themeMode===`light`?Be:Y.themeMode===`dark`?Re:ze),M=K(()=>Y.themeMode===`light`?`浅色模式`:Y.themeMode===`dark`?`深色模式`:`跟随系统`),N=K(()=>[{key:`header`,type:`render`,render:()=>j(`div`,{class:`user-menu-head`},[j(`div`,{class:`user-menu-name`},(Z.user?.email||`管理员`).split(`@`)[0]),j(`div`,{class:`user-menu-mail`},Z.user?.email||``)])},{type:`divider`,key:`d0`},{key:`settings`,label:`系统配置`,icon:d(We)},{key:`legacy`,label:`切换到旧版后台`,icon:d(Zt)},{type:`divider`,key:`d1`},{key:`logout`,label:`退出登录`,icon:d(Gt)}]);async function P(e){if(e===`settings`)o.push(`/config/system`);else if(e===`legacy`)window.location.href=X.legacyAdminUrl;else if(e===`logout`){if(!await he({title:`退出登录`,content:`确定要退出当前管理员账号吗？`,type:`info`}))return;Me(),o.replace(`/login`)}}function F(e){e.defaultPrevented||(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()===`k`&&(e.preventDefault(),u.value=!u.value)}C(()=>a.path,()=>c.value=!1),t(async()=>{if(window.addEventListener(`keydown`,F),Ue().catch(()=>void 0),!Z.user)try{Z.user=await Te.get(`/api/v2/user/info`,void 0,{silent:!0})}catch{}}),g(()=>window.removeEventListener(`keydown`,F));let I=R(!1),B=K(()=>(Z.user?.email||`AD`).slice(0,2).toUpperCase()),V=/Mac|iPhone|iPad/.test(navigator.platform);return(e,t)=>{let a=l(`router-view`);return s(),G(z(rt),{"has-sider":``,class:`admin-root`},{default:w(()=>[z(Y).isMobile?(s(),G(z(ke),{key:1,show:c.value,"onUpdate:show":t[2]||=e=>c.value=e,placement:`left`,width:270},{default:w(()=>[r(z(Ae),{"body-content-style":{padding:0}},{default:w(()=>[E(`div`,dn,[z(X).logo?(s(),n(`img`,{key:0,src:z(X).logo,class:`brand-logo`,alt:``},null,8,fn)):(s(),n(`div`,pn,H(z(X).title.slice(0,1)),1)),E(`span`,mn,H(z(X).title),1)]),r(z(Ut),{"expanded-keys":T.value,"onUpdate:expandedKeys":t[1]||=e=>T.value=e,value:S.value,options:m.value,indent:18},null,8,[`expanded-keys`,`value`,`options`])]),_:1})]),_:1},8,[`show`])):(s(),G(z(ht),{key:0,bordered:``,"collapse-mode":`width`,collapsed:z(Y).siderCollapsed,"collapsed-width":64,width:236,"native-scrollbar":!1,class:`admin-sider`},{default:w(()=>[E(`div`,{class:D([`brand`,{collapsed:z(Y).siderCollapsed}])},[z(X).logo?(s(),n(`img`,{key:0,src:z(X).logo,class:`brand-logo`,alt:``},null,8,sn)):(s(),n(`div`,cn,H(z(X).title.slice(0,1)),1)),z(Y).siderCollapsed?_(``,!0):(s(),n(`span`,ln,H(z(X).title),1))],2),r(z(Ut),{"expanded-keys":T.value,"onUpdate:expandedKeys":t[0]||=e=>T.value=e,value:S.value,options:m.value,collapsed:z(Y).siderCollapsed,"collapsed-width":64,"collapsed-icon-size":20,indent:18},null,8,[`expanded-keys`,`value`,`options`,`collapsed`]),z(Y).siderCollapsed?_(``,!0):(s(),n(`div`,un,[t[9]||=E(`span`,{class:`dot`},null,-1),i(`v`+H(z(X).version),1)]))]),_:1},8,[`collapsed`])),r(z(rt),{class:`admin-main`,"native-scrollbar":!0},{default:w(()=>[r(z(st),{bordered:``,class:`admin-header`},{default:w(()=>[E(`div`,hn,[z(Y).isMobile?(s(),G(z(L),{key:0,quaternary:``,circle:``,"aria-label":`切换导航`,onClick:t[3]||=e=>c.value=!0},{icon:w(()=>[r(z(q),null,{default:w(()=>[r(z(qt))]),_:1})]),_:1})):(s(),G(z(L),{key:1,quaternary:``,circle:``,"aria-label":z(Y).siderCollapsed?`展开侧栏`:`收起侧栏`,onClick:t[4]||=e=>z(Y).siderCollapsed=!z(Y).siderCollapsed},{icon:w(()=>[r(z(q),null,{default:w(()=>[z(Y).siderCollapsed?(s(),G(z(Le),{key:0})):(s(),G(z(Ie),{key:1}))]),_:1})]),_:1},8,[`aria-label`])),E(`nav`,gn,[(s(!0),n(k,null,b(O.value,(e,t)=>(s(),n(k,{key:t},[t>0?(s(),n(`span`,_n,`/`)):_(``,!0),E(`span`,{class:D({"crumb-current":t===O.value.length-1})},H(e),3)],64))),128))])]),E(`div`,vn,[z(Y).isMobile?(s(),G(z(L),{key:1,quaternary:``,circle:``,"aria-label":`搜索`,onClick:t[6]||=e=>u.value=!0},{icon:w(()=>[r(z(q),null,{default:w(()=>[r(z(qe))]),_:1})]),_:1})):(s(),n(`button`,{key:0,type:`button`,class:`search-trigger`,onClick:t[5]||=e=>u.value=!0},[r(z(q),null,{default:w(()=>[r(z(qe))]),_:1}),t[10]||=E(`span`,null,`搜索菜单和功能...`,-1),E(`kbd`,null,H(z(V)?`⌘`:`Ctrl`)+` K`,1)])),r(z(Se),null,{trigger:w(()=>[r(z(L),{quaternary:``,circle:``,"aria-label":M.value,onClick:z(de)},{icon:w(()=>[r(z(q),null,{default:w(()=>[(s(),G(ee(A.value)))]),_:1})]),_:1},8,[`aria-label`,`onClick`])]),default:w(()=>[i(` `+H(M.value)+`（点击切换） `,1)]),_:1}),r(z(we),{trigger:`click`,placement:`bottom-end`,options:N.value,onSelect:P},{default:w(()=>[E(`button`,yn,[z(Z).user?.avatar_url&&!I.value?(s(),G(z(De),{key:0,round:``,size:28,src:z(Z).user.avatar_url,"img-props":{referrerpolicy:`no-referrer`},onError:t[7]||=e=>I.value=!0},null,8,[`src`])):(s(),G(z(De),{key:1,round:``,size:28,class:`user-avatar`},{default:w(()=>[i(H(B.value),1)]),_:1})),z(Y).isMobile?_(``,!0):(s(),n(`span`,bn,H(z(Z).user?.email||`管理员`),1))])]),_:1},8,[`options`])])]),_:1}),r(z(it),{class:`admin-content`,"content-class":`admin-content-inner`},{default:w(()=>[r(a,null,{default:w(({Component:e})=>[(s(),G(ee(e),{key:y.value}))]),_:1})]),_:1})]),_:1}),r(on,{show:u.value,"onUpdate:show":t[8]||=e=>u.value=e,items:v.value},null,8,[`show`,`items`])]),_:1})}}}),[[`__scopeId`,`data-v-12298087`]]);export{xn as default};