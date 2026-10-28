import{$t as e,A as t,Bn as n,Cn as r,F as i,Fn as a,Hn as o,Jt as s,L as c,M as l,Mn as u,Pn as d,Qn as f,R as p,T as m,Un as h,Vt as g,Wt as _,Xn as v,Xt as y,Yn as b,Zt as x,bn as S,cn as C,dn as w,en as T,ft as E,hn as D,ht as O,jn as k,kn as A,lr as j,lt as M,nn as N,or as P,r as F,rr as I,st as L,tn as R,ut as z,vn as ee,vt as te,xn as B,yn as V,yt as ne}from"./light-C36WBRZZ.js";import{s as re}from"./_plugin-vue_export-helper-Y2v3pMRv.js";import{$ as ie,B as H,Bt as U,St as ae,f as oe,it as W,lt as G}from"./discrete-BMBIarA6.js";import{m as se,p as ce,v as le,y as ue}from"./Tooltip-CjyHKpY1.js";import{t as de}from"./ChevronLeft-BtKpvL8n.js";import{t as fe}from"./ChevronRight-ClAMSliO.js";import{t as pe}from"./Add-CR8xoXXa.js";var me=/\s/;function he(e){for(var t=e.length;t--&&me.test(e.charAt(t)););return t}var ge=/^\s+/;function _e(e){return e&&e.slice(0,he(e)+1).replace(ge,``)}var K=NaN,q=/^[-+]0x[0-9a-f]+$/i,J=/^0b[01]+$/i,Y=/^0o[0-7]+$/i,ve=parseInt;function ye(e){if(typeof e==`number`)return e;if(_(e))return K;if(g(e)){var t=typeof e.valueOf==`function`?e.valueOf():e;e=g(t)?t+``:t}if(typeof e!=`string`)return e===0?e:+e;e=_e(e);var n=J.test(e);return n||Y.test(e)?ve(e.slice(2),n?2:8):q.test(e)?K:+e}var X=function(){return s.Date.now()},be=`Expected a function`,Z=Math.max,xe=Math.min;function Se(e,t,n){var r,i,a,o,s,c,l=0,u=!1,d=!1,f=!0;if(typeof e!=`function`)throw TypeError(be);t=ye(t)||0,g(n)&&(u=!!n.leading,d=`maxWait`in n,a=d?Z(ye(n.maxWait)||0,t):a,f=`trailing`in n?!!n.trailing:f);function p(t){var n=r,a=i;return r=i=void 0,l=t,o=e.apply(a,n),o}function m(e){return l=e,s=setTimeout(v,t),u?p(e):o}function h(e){var n=e-c,r=e-l,i=t-n;return d?xe(i,a-r):i}function _(e){var n=e-c,r=e-l;return c===void 0||n>=t||n<0||d&&r>=a}function v(){var e=X();if(_(e))return y(e);s=setTimeout(v,h(e))}function y(e){return s=void 0,f&&r?p(e):(r=i=void 0,o)}function b(){s!==void 0&&clearTimeout(s),l=0,r=c=i=s=void 0}function x(){return s===void 0?o:y(X())}function S(){var e=X(),n=_(e);if(r=arguments,i=this,c=e,n){if(s===void 0)return m(c);if(d)return clearTimeout(s),s=setTimeout(v,t),p(c)}return s===void 0&&(s=setTimeout(v,t)),o}return S.cancel=b,S.flush=x,S}var Ce=`Expected a function`;function we(e,t,n){var r=!0,i=!0;if(typeof e!=`function`)throw TypeError(Ce);return g(n)&&(r=`leading`in n?!!n.leading:r,i=`trailing`in n?!!n.trailing:i),Se(e,t,{leading:r,maxWait:t,trailing:i})}var Te=ce(`.v-x-scroll`,{overflow:`auto`,scrollbarWidth:`none`},[ce(`&::-webkit-scrollbar`,{width:0,height:0})]),Q=A({name:`XScroll`,props:{disabled:Boolean,onScroll:Function},setup(){let e=I(null);function t(e){e.currentTarget.offsetWidth<e.currentTarget.scrollWidth&&e.deltaY!==0&&(e.currentTarget.scrollLeft+=e.deltaY+e.deltaX,e.preventDefault())}let n=E();return Te.mount({id:`vueuc/x-scroll`,head:!0,anchorMetaName:se,ssr:n}),Object.assign({selfRef:e,handleWheel:t},{scrollTo(...t){var n;(n=e.value)==null||n.scrollTo(...t)}})},render(){return k(`div`,{ref:`selfRef`,onScroll:this.onScroll,onWheel:this.disabled?void 0:this.handleWheel,class:`v-x-scroll`},this.$slots)}}),Ee=te(`n-tabs`),De={tab:[String,Number,Object,Function],name:{type:[String,Number],required:!0},disabled:Boolean,displayDirective:{type:String,default:`if`},closable:{type:Boolean,default:void 0},tabProps:Object,label:[String,Number,Object,Function]},Oe=A({__TAB_PANE__:!0,name:`TabPane`,alias:[`TabPanel`],props:De,slots:Object,setup(e){let t=u(Ee,null);return t||ne(`tab-pane`,"`n-tab-pane` must be placed inside `n-tabs`."),{style:t.paneStyleRef,class:t.paneClassRef,mergedClsPrefix:t.mergedClsPrefixRef}},render(){return o(),r(`div`,{class:L([`${this.mergedClsPrefix}-tab-pane`,this.class]),style:j(this.style)},[z(()=>this.$slots.default?.())],6)}}),ke=[`data-name`,`data-disabled`],Ae={internalLeftPadded:Boolean,internalAddable:Boolean,internalCreatedByPane:Boolean,...H(De,[`displayDirective`])},$=A({__TAB__:!0,inheritAttrs:!1,name:`Tab`,props:Ae,setup(e){let{mergedClsPrefixRef:t,valueRef:n,typeRef:r,closableRef:i,tabStyleRef:a,addTabStyleRef:o,tabClassRef:s,addTabClassRef:c,tabChangeIdRef:l,onBeforeLeaveRef:d,triggerRef:f,handleAdd:p,activateTab:m,handleClose:h}=u(Ee);return{trigger:f,mergedClosable:V(()=>{if(e.internalAddable)return!1;let{closable:t}=e;return t===void 0?i.value:t}),style:a,addStyle:o,tabClass:s,addTabClass:c,clsPrefix:t,value:n,type:r,handleClose(t){t.stopPropagation(),!e.disabled&&h(e.name)},activateTab(){if(e.disabled)return;if(e.internalAddable){p();return}let{name:t}=e,r=++l.id;if(t!==n.value){let{value:i}=d;i?Promise.resolve(i(e.name,n.value)).then(e=>{e&&l.id===r&&m(t)}):m(t)}}}},render(){let{internalAddable:e,clsPrefix:t,name:n,disabled:a,label:s,tab:c,value:l,mergedClosable:u,trigger:f,$slots:{default:p}}=this,m=s??c;return o(),r(`div`,{class:L(`${t}-tabs-tab-wrapper`)},[this.internalLeftPadded?(o(),r(`div`,{key:0,class:L(`${t}-tabs-tab-pad`)},null,2)):z(()=>null),(o(),r(`div`,d({key:n,"data-name":n,"data-disabled":a?!0:void 0},d({class:[`${t}-tabs-tab`,l===n&&`${t}-tabs-tab--active`,a&&`${t}-tabs-tab--disabled`,u&&`${t}-tabs-tab--closable`,e&&`${t}-tabs-tab--addable`,e?this.addTabClass:this.tabClass],onClick:f===`click`?this.activateTab:void 0,onMouseenter:f===`hover`?this.activateTab:void 0,style:e?this.addStyle:this.style},this.internalCreatedByPane?this.tabProps||{}:this.$attrs)),[S(`span`,{class:L(`${t}-tabs-tab__label`)},[e?(o(),r(D,{key:0},[S(`div`,{class:L(`${t}-tabs-tab__height-placeholder`)},`\xA0`,2),(o(),B(i,{clsPrefix:t},{default:()=>(o(),B(pe))},1032,[`clsPrefix`]))],64)):(o(),r(D,{key:1},[p?(o(),r(D,{key:0},[z(()=>p())],64)):(o(),r(D,{key:1},[typeof m==`object`?(o(),r(D,{key:0},[z(()=>m)],64)):(o(),r(D,{key:1},[z(()=>ie(m??n))],64))],64))],64))],2),u&&this.type===`card`?(o(),B(W,{key:0,clsPrefix:t,class:L(`${t}-tabs-tab__close`),onClick:this.handleClose,disabled:a},null,8,[`clsPrefix`,`class`,`onClick`,`disabled`])):z(()=>null)],16,ke))],2)}}),je=x(`tabs`,`
 box-sizing: border-box;
 width: 100%;
 display: flex;
 flex-direction: column;
 transition:
 background-color .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
`,[y(`&.transition-disabled`,[x(`tabs-tab`,`
 transition: none !important;
 `),x(`tabs-nav-scroll-content`,`
 transition: none !important;
 `),x(`tabs-tab-pad`,`
 transition: none !important;
 `)]),T(`segment-type`,[x(`tabs-rail`,[y(`&.transition-disabled`,[x(`tabs-capsule`,`
 transition: none;
 `)])])]),T(`top`,[x(`tab-pane`,`
 padding: var(--n-pane-padding-top) var(--n-pane-padding-right) var(--n-pane-padding-bottom) var(--n-pane-padding-left);
 `)]),T(`left`,[x(`tab-pane`,`
 padding: var(--n-pane-padding-right) var(--n-pane-padding-bottom) var(--n-pane-padding-left) var(--n-pane-padding-top);
 `)]),T(`left, right`,`
 flex-direction: row;
 `,[x(`tabs-bar`,`
 width: 2px;
 right: 0;
 transition:
 top .2s var(--n-bezier),
 max-height .2s var(--n-bezier),
 background-color .3s var(--n-bezier);
 `),x(`tabs-tab`,`
 padding: var(--n-tab-padding-vertical); 
 `)]),T(`right`,`
 flex-direction: row-reverse;
 `,[x(`tab-pane`,`
 padding: var(--n-pane-padding-left) var(--n-pane-padding-top) var(--n-pane-padding-right) var(--n-pane-padding-bottom);
 `),x(`tabs-bar`,`
 left: 0;
 `)]),T(`bottom`,`
 flex-direction: column-reverse;
 justify-content: flex-end;
 `,[x(`tab-pane`,`
 padding: var(--n-pane-padding-bottom) var(--n-pane-padding-right) var(--n-pane-padding-top) var(--n-pane-padding-left);
 `),x(`tabs-bar`,`
 top: 0;
 `)]),x(`tabs-rail`,`
 position: relative;
 padding: 3px;
 border-radius: var(--n-tab-border-radius);
 width: 100%;
 background-color: var(--n-color-segment);
 transition: background-color .3s var(--n-bezier);
 display: flex;
 align-items: center;
 `,[x(`tabs-capsule`,`
 border-radius: var(--n-tab-border-radius);
 position: absolute;
 left: 0;
 top: 0;
 pointer-events: none;
 background-color: var(--n-tab-color-segment);
 box-shadow: 0 1px 3px 0 rgba(0, 0, 0, .08);
 transition: transform 0.3s var(--n-bezier);
 `),x(`tabs-tab-wrapper`,`
 flex-basis: 0;
 flex-grow: 1;
 display: flex;
 align-items: center;
 justify-content: center;
 `,[x(`tabs-tab`,`
 overflow: hidden;
 border-radius: var(--n-tab-border-radius);
 width: 100%;
 display: flex;
 align-items: center;
 justify-content: center;
 `,[T(`active`,`
 font-weight: var(--n-font-weight-strong);
 color: var(--n-tab-text-color-active);
 `),y(`&:hover`,`
 color: var(--n-tab-text-color-hover);
 `)])])]),T(`flex`,[x(`tabs-nav`,`
 width: 100%;
 position: relative;
 `,[x(`tabs-wrapper`,`
 width: 100%;
 `,[x(`tabs-tab`,`
 margin-right: 0;
 `)])])]),x(`tabs-nav`,`
 box-sizing: border-box;
 line-height: 1.5;
 display: flex;
 transition: border-color .3s var(--n-bezier);
 `,[e(`prefix, suffix`,`
 display: flex;
 align-items: center;
 `),e(`prefix`,`padding-right: 16px;`),e(`suffix`,`padding-left: 16px;`)]),T(`top, bottom`,[y(`>`,[x(`tabs-nav`,[x(`tabs-nav-scroll-wrapper`,[y(`&::before`,`
 top: 0;
 bottom: 0;
 left: 0;
 width: 20px;
 `),y(`&::after`,`
 top: 0;
 bottom: 0;
 right: 0;
 width: 20px;
 `),T(`shadow-start`,[y(`&::before`,`
 box-shadow: inset 10px 0 8px -8px rgba(0, 0, 0, .12);
 `)]),T(`shadow-end`,[y(`&::after`,`
 box-shadow: inset -10px 0 8px -8px rgba(0, 0, 0, .12);
 `)])])])])]),T(`left, right`,[x(`tabs-nav-scroll-content`,`
 flex-direction: column;
 `),y(`>`,[x(`tabs-nav`,[x(`tabs-nav-scroll-wrapper`,[y(`&::before`,`
 top: 0;
 left: 0;
 right: 0;
 height: 20px;
 `),y(`&::after`,`
 bottom: 0;
 left: 0;
 right: 0;
 height: 20px;
 `),T(`shadow-start`,[y(`&::before`,`
 box-shadow: inset 0 10px 8px -8px rgba(0, 0, 0, .12);
 `)]),T(`shadow-end`,[y(`&::after`,`
 box-shadow: inset 0 -10px 8px -8px rgba(0, 0, 0, .12);
 `)])])])])]),x(`tabs-nav-scroll-wrapper`,`
 flex: 1;
 position: relative;
 overflow: hidden;
 `,[x(`tabs-nav-y-scroll`,`
 height: 100%;
 width: 100%;
 overflow-y: auto; 
 scrollbar-width: none;
 `,[y(`&::-webkit-scrollbar, &::-webkit-scrollbar-track-piece, &::-webkit-scrollbar-thumb`,`
 width: 0;
 height: 0;
 display: none;
 `)]),y(`&::before, &::after`,`
 transition: box-shadow .3s var(--n-bezier);
 pointer-events: none;
 content: "";
 position: absolute;
 z-index: 1;
 `),y(`&.transition-disabled`,[y(`&::before, &::after`,`
 transition: none;
 `)])]),x(`tabs-nav-scroll-content`,`
 display: flex;
 position: relative;
 min-width: 100%;
 min-height: 100%;
 width: fit-content;
 box-sizing: border-box;
 `),x(`tabs-wrapper`,`
 display: inline-flex;
 flex-wrap: nowrap;
 position: relative;
 `),x(`tabs-tab-wrapper`,`
 display: flex;
 flex-wrap: nowrap;
 flex-shrink: 0;
 flex-grow: 0;
 `),x(`tabs-tab`,`
 cursor: pointer;
 white-space: nowrap;
 flex-wrap: nowrap;
 display: inline-flex;
 align-items: center;
 color: var(--n-tab-text-color);
 font-size: var(--n-tab-font-size);
 background-clip: padding-box;
 padding: var(--n-tab-padding);
 transition:
 box-shadow .3s var(--n-bezier),
 color .3s var(--n-bezier),
 background-color .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
 `,[T(`disabled`,{cursor:`not-allowed`}),e(`close`,`
 margin-inline-start: 6px;
 transition:
 background-color .3s var(--n-bezier),
 color .3s var(--n-bezier);
 `),e(`label`,`
 display: flex;
 align-items: center;
 z-index: 1;
 `)]),x(`tabs-bar`,`
 position: absolute;
 bottom: 0;
 height: 2px;
 border-radius: 1px;
 background-color: var(--n-bar-color);
 transition:
 left .2s var(--n-bezier),
 max-width .2s var(--n-bezier),
 opacity .3s var(--n-bezier),
 background-color .3s var(--n-bezier);
 `,[y(`&.transition-disabled`,`
 transition: none;
 `),T(`disabled`,`
 background-color: var(--n-tab-text-color-disabled)
 `)]),x(`tabs-pane-wrapper`,`
 position: relative;
 overflow: hidden;
 transition: max-height .2s var(--n-bezier);
 `),x(`tab-pane`,`
 color: var(--n-pane-text-color);
 width: 100%;
 transition:
 color .3s var(--n-bezier),
 background-color .3s var(--n-bezier),
 opacity .2s var(--n-bezier);
 left: 0;
 right: 0;
 top: 0;
 `,[y(`&.next-transition-leave-active, &.prev-transition-leave-active, &.next-transition-enter-active, &.prev-transition-enter-active`,`
 transition:
 color .3s var(--n-bezier),
 background-color .3s var(--n-bezier),
 transform .2s var(--n-bezier),
 opacity .2s var(--n-bezier);
 `),y(`&.next-transition-leave-active, &.prev-transition-leave-active`,`
 position: absolute;
 `),y(`&.next-transition-enter-from, &.prev-transition-leave-to`,`
 transform: translateX(32px);
 opacity: 0;
 `),y(`&.next-transition-leave-to, &.prev-transition-enter-from`,`
 transform: translateX(-32px);
 opacity: 0;
 `),y(`&.next-transition-leave-from, &.next-transition-enter-to, &.prev-transition-leave-from, &.prev-transition-enter-to`,`
 transform: translateX(0);
 opacity: 1;
 `)]),x(`tabs-tab-pad`,`
 box-sizing: border-box;
 width: var(--n-tab-gap);
 flex-grow: 0;
 flex-shrink: 0;
 `),T(`line-type, bar-type`,[x(`tabs-tab`,`
 font-weight: var(--n-tab-font-weight);
 box-sizing: border-box;
 vertical-align: bottom;
 `,[y(`&:hover`,{color:`var(--n-tab-text-color-hover)`}),T(`active`,`
 color: var(--n-tab-text-color-active);
 font-weight: var(--n-tab-font-weight-active);
 `),T(`disabled`,{color:`var(--n-tab-text-color-disabled)`})])]),x(`tabs-nav`,[e(`prefix, suffix`,`
 border-color: var(--n-tab-border-color);
 `),x(`tabs-nav-scroll-content`,`
 border-color: var(--n-tab-border-color);
 `),T(`line-type`,[T(`top`,[e(`prefix, suffix`,`
 border-bottom: 1px solid var(--n-tab-border-color);
 `),x(`tabs-nav-scroll-content`,`
 border-bottom: 1px solid var(--n-tab-border-color);
 `),x(`tabs-bar`,`
 bottom: -1px;
 `)]),T(`left`,[e(`prefix, suffix`,`
 border-right: 1px solid var(--n-tab-border-color);
 `),x(`tabs-nav-scroll-content`,`
 border-right: 1px solid var(--n-tab-border-color);
 `),x(`tabs-bar`,`
 right: -1px;
 `)]),T(`right`,[e(`prefix, suffix`,`
 border-left: 1px solid var(--n-tab-border-color);
 `),x(`tabs-nav-scroll-content`,`
 border-left: 1px solid var(--n-tab-border-color);
 `),x(`tabs-bar`,`
 left: -1px;
 `)]),T(`bottom`,[e(`prefix, suffix`,`
 border-top: 1px solid var(--n-tab-border-color);
 `),x(`tabs-nav-scroll-content`,`
 border-top: 1px solid var(--n-tab-border-color);
 `),x(`tabs-bar`,`
 top: -1px;
 `)]),e(`prefix, suffix`,`
 transition: border-color .3s var(--n-bezier);
 `),x(`tabs-nav-scroll-content`,`
 transition: border-color .3s var(--n-bezier);
 `),x(`tabs-bar`,`
 border-radius: 0;
 `)]),T(`card-type`,[e(`prefix, suffix`,`
 transition: border-color .3s var(--n-bezier);
 `),x(`tabs-pad`,`
 flex-grow: 1;
 transition: border-color .3s var(--n-bezier);
 `),x(`tabs-tab-pad`,`
 transition: border-color .3s var(--n-bezier);
 `),x(`tabs-tab`,`
 font-weight: var(--n-tab-font-weight);
 border: 1px solid var(--n-tab-border-color);
 background-color: var(--n-tab-color);
 box-sizing: border-box;
 position: relative;
 vertical-align: bottom;
 display: flex;
 justify-content: space-between;
 font-size: var(--n-tab-font-size);
 color: var(--n-tab-text-color);
 `,[T(`addable`,`
 padding-left: 8px;
 padding-right: 8px;
 font-size: 16px;
 justify-content: center;
 `,[e(`height-placeholder`,`
 width: 0;
 font-size: var(--n-tab-font-size);
 `),R(`disabled`,[y(`&:hover`,`
 color: var(--n-tab-text-color-hover);
 `)])]),T(`closable`,`padding-inline-end: 8px;`),T(`active`,`
 background-color: #0000;
 font-weight: var(--n-tab-font-weight-active);
 color: var(--n-tab-text-color-active);
 `),T(`disabled`,`color: var(--n-tab-text-color-disabled);`)])]),T(`left, right`,`
 flex-direction: column; 
 `,[e(`prefix, suffix`,`
 padding: var(--n-tab-padding-vertical);
 `),x(`tabs-wrapper`,`
 flex-direction: column;
 `),x(`tabs-tab-wrapper`,`
 flex-direction: column;
 `,[x(`tabs-tab-pad`,`
 height: var(--n-tab-gap-vertical);
 width: 100%;
 `)])]),T(`top`,[T(`card-type`,[x(`tabs-scroll-padding`,`border-bottom: 1px solid var(--n-tab-border-color);`),e(`prefix, suffix`,`
 border-bottom: 1px solid var(--n-tab-border-color);
 `),x(`tabs-tab`,`
 border-top-left-radius: var(--n-tab-border-radius);
 border-top-right-radius: var(--n-tab-border-radius);
 `,[T(`active`,`
 border-bottom: 1px solid #0000;
 `)]),x(`tabs-tab-pad`,`
 border-bottom: 1px solid var(--n-tab-border-color);
 `),x(`tabs-pad`,`
 border-bottom: 1px solid var(--n-tab-border-color);
 `)])]),T(`left`,[T(`card-type`,[x(`tabs-scroll-padding`,`border-right: 1px solid var(--n-tab-border-color);`),e(`prefix, suffix`,`
 border-right: 1px solid var(--n-tab-border-color);
 `),x(`tabs-tab`,`
 border-top-left-radius: var(--n-tab-border-radius);
 border-bottom-left-radius: var(--n-tab-border-radius);
 `,[T(`active`,`
 border-right: 1px solid #0000;
 `)]),x(`tabs-tab-pad`,`
 border-right: 1px solid var(--n-tab-border-color);
 `),x(`tabs-pad`,`
 border-right: 1px solid var(--n-tab-border-color);
 `)])]),T(`right`,[T(`card-type`,[x(`tabs-scroll-padding`,`border-left: 1px solid var(--n-tab-border-color);`),e(`prefix, suffix`,`
 border-left: 1px solid var(--n-tab-border-color);
 `),x(`tabs-tab`,`
 border-top-right-radius: var(--n-tab-border-radius);
 border-bottom-right-radius: var(--n-tab-border-radius);
 `,[T(`active`,`
 border-left: 1px solid #0000;
 `)]),x(`tabs-tab-pad`,`
 border-left: 1px solid var(--n-tab-border-color);
 `),x(`tabs-pad`,`
 border-left: 1px solid var(--n-tab-border-color);
 `)])]),T(`bottom`,[T(`card-type`,[x(`tabs-scroll-padding`,`border-top: 1px solid var(--n-tab-border-color);`),e(`prefix, suffix`,`
 border-top: 1px solid var(--n-tab-border-color);
 `),x(`tabs-tab`,`
 border-bottom-left-radius: var(--n-tab-border-radius);
 border-bottom-right-radius: var(--n-tab-border-radius);
 `,[T(`active`,`
 border-top: 1px solid #0000;
 `)]),x(`tabs-tab-pad`,`
 border-top: 1px solid var(--n-tab-border-color);
 `),x(`tabs-pad`,`
 border-top: 1px solid var(--n-tab-border-color);
 `)])])]),x(`tabs-scroll-button`,[T(`start`,`
 padding-left: 10px;
 padding-right: 6px;
 `),T(`end`,`
 padding-right: 10px;
 padding-left: 6px;
 `),T(`up`,`
 padding-bottom: 10px;
 `),T(`down`,`
 padding-top: 10px;
 `)])]),Me=A({name:`TabsButton`,props:{type:{type:String,default:`next`},mergedClsPrefix:{type:String,required:!0},vertical:Boolean,disabled:Boolean,rtl:Boolean,theme:Object,themeOverrides:Object,onClick:Function},setup(e){return{handleClick:()=>{e.disabled||e.onClick?.(e.type)}}},render(){let{mergedClsPrefix:e,disabled:t,type:n,vertical:r,rtl:a,theme:s,themeOverrides:c,handleClick:l}=this,u=n===`next`,d=r?u:a?!u:u;return o(),B(F,{text:!0,disabled:t,size:`small`,theme:s,themeOverrides:c,onClick:l,class:L([`${e}-tabs-scroll-button`,!r&&n===`prev`&&`${e}-tabs-scroll-button--start`,!r&&n===`next`&&`${e}-tabs-scroll-button--end`,r&&n===`prev`&&`${e}-tabs-scroll-button--up`,r&&n===`next`&&`${e}-tabs-scroll-button--down`])},{icon:()=>(o(),B(i,{clsPrefix:e,style:j(r?{transform:`rotate(90deg)`}:void 0)},{default:()=>d?(o(),B(fe,{key:1})):(o(),B(de,{key:2}))},1032,[`clsPrefix`,`style`]))},1032,[`disabled`,`theme`,`themeOverrides`,`onClick`,`class`])}}),Ne=we,Pe={...c.props,value:[String,Number],defaultValue:[String,Number],trigger:{type:String,default:`click`},type:{type:String,default:`bar`},closable:Boolean,justifyContent:String,size:String,placement:{type:String,default:`top`},tabStyle:[String,Object],tabClass:String,addTabStyle:[String,Object],addTabClass:String,barWidth:Number,paneClass:String,paneStyle:[String,Object],paneWrapperClass:String,paneWrapperStyle:[String,Object],addable:[Boolean,Object],tabsPadding:{type:Number,default:0},animated:Boolean,onBeforeLeave:Function,onAdd:Function,"onUpdate:value":[Function,Array],onUpdateValue:[Function,Array],onClose:[Function,Array],labelSize:String,activeName:[String,Number],onActiveNameChange:[Function,Array],showScrollButton:Boolean,centerActiveTab:Boolean},Fe=A({name:`Tabs`,props:Pe,slots:Object,setup(e,{slots:t}){let{mergedClsPrefixRef:r,inlineThemeDisabled:i,mergedComponentPropsRef:o,mergedRtlRef:s}=O(e),u=m(`Tabs`,s,r),d=V(()=>{let{placement:t}=e;return t===`start`?u?.value?`right`:`left`:t===`end`?u?.value?`left`:`right`:t}),f=c(`Tabs`,`-tabs`,je,oe,e,r),g=I(null),_=I(null),y=I(null),x=I(null),S=I(null),C=I(null),w=I(null),T=I(!0),E=I(!0),D=le(e,[`labelSize`,`size`]),k=V(()=>D.value?D.value:o?.value?.Tabs?.size||`medium`),A=le(e,[`activeName`,`value`]),j=I(A.value??e.defaultValue??(t.default?ae(t.default())[0]?.props?.name:null)),M=re(A,j),F={id:0},L=V(()=>{if(e.justifyContent&&e.type!==`card`)return{display:`flex`,justifyContent:e.justifyContent}});b(M,()=>{F.id=0,B(),a(()=>{ie()})});function R(){let{value:e}=M;return e===null?null:g.value?.querySelector(`[data-name="${e}"]`)}function z(t){if(e.type===`card`)return;let{value:n}=y;if(!n)return;let i=n.style.opacity===`0`;if(t){let a=`${r.value}-tabs-bar--disabled`,{barWidth:o}=e,s=d.value;if(t.dataset.disabled===`true`?n.classList.add(a):n.classList.remove(a),[`top`,`bottom`].includes(s)){if(te([`top`,`maxHeight`,`height`]),typeof o==`number`&&t.offsetWidth>=o){let e=Math.floor((t.offsetWidth-o)/2)+t.offsetLeft;n.style.left=`${e}px`,n.style.maxWidth=`${o}px`}else n.style.left=`${t.offsetLeft}px`,n.style.maxWidth=`${t.offsetWidth}px`;n.style.width=`8192px`,i&&(n.style.transition=`none`),n.offsetWidth,i&&(n.style.transition=``,n.style.opacity=`1`)}else{if(te([`left`,`maxWidth`,`width`]),typeof o==`number`&&t.offsetHeight>=o){let e=Math.floor((t.offsetHeight-o)/2)+t.offsetTop;n.style.top=`${e}px`,n.style.maxHeight=`${o}px`}else n.style.top=`${t.offsetTop}px`,n.style.maxHeight=`${t.offsetHeight}px`;n.style.height=`8192px`,i&&(n.style.transition=`none`),n.offsetHeight,i&&(n.style.transition=``,n.style.opacity=`1`)}}}function ee(){if(e.type===`card`)return;let{value:t}=y;t&&(t.style.opacity=`0`)}function te(e){let{value:t}=y;if(t)for(let n of e)t.style[n]=``}function B(){if(e.type===`card`)return;let t=R();t?z(t):ee()}function ne(e,t,n,r){let i=e.getBoundingClientRect(),a=t.getBoundingClientRect(),o=n?`left`:`top`,s=n?`right`:`bottom`,c=0;r?c=(a[o]+a[s])/2-(i[o]+i[s])/2:a[o]<i[o]?c=a[o]-i[o]:a[s]>i[s]&&(c=a[s]-i[s]),c!==0&&e.scrollBy({[o]:c,behavior:`smooth`})}function ie(){let t=[`top`,`bottom`].includes(d.value),n=R();if(n){if(t){let r=C.value?.$el;if(!r)return;ne(r,n,t,e.centerActiveTab)}else{let{value:r}=w;if(!r)return;ne(r,n,t,e.centerActiveTab)}}}let H=I(null),W=0,G=null;function se(e){let t=H.value;if(t){W=e.getBoundingClientRect().height;let n=`${W}px`,r=()=>{t.style.height=n,t.style.maxHeight=n};G?(r(),G(),G=null):G=r}}function ce(e){let t=H.value;if(t){let n=e.getBoundingClientRect().height,r=()=>{document.body.offsetHeight,t.style.maxHeight=`${n}px`,t.style.height=`${Math.max(W,n)}px`};G?(G(),G=null,r()):G=r}}function de(){let t=H.value;if(t){t.style.maxHeight=``,t.style.height=``;let{paneWrapperStyle:n}=e;if(typeof n==`string`)t.style.cssText=n;else if(n){let{maxHeight:e,height:r}=n;e!==void 0&&(t.style.maxHeight=e),r!==void 0&&(t.style.height=r)}}}let fe={value:[]},pe=I(`next`);function me(e){let t=M.value,n=`next`;for(let r of fe.value){if(r===t)break;if(r===e){n=`prev`;break}}pe.value=n,he(e)}function he(t){let{onActiveNameChange:n,onUpdateValue:r,"onUpdate:value":i}=e;n&&l(n,t),r&&l(r,t),i&&l(i,t),j.value=t}function ge(t){let{onClose:n}=e;n&&l(n,t)}function _e(e){if([`top`,`bottom`].includes(d.value)){let{value:t}=C;if(!t)return;let n=t.$el;if(!n)return;let r=n.offsetWidth,i=!!u?.value,a=e===`next`?r:-r;n.scrollBy({left:i?-a:a,behavior:`smooth`})}else{let{value:t}=w;if(!t)return;let n=t.offsetHeight,r=e===`next`?t.scrollTop+n:t.scrollTop-n;t.scrollTo({top:r,left:0,behavior:`smooth`})}}let K=!0;function q(){let{value:e}=y;if(!e)return;K&&=!1;let t=`transition-disabled`;e.classList.add(t),B(),e.classList.remove(t)}let J=I(null);function Y({transitionDisabled:e}){let t=g.value;if(!t)return;e&&t.classList.add(`transition-disabled`);let n=R();n&&J.value&&(J.value.style.width=`${n.offsetWidth}px`,J.value.style.height=`${n.offsetHeight}px`,J.value.style.transform=`translate(${n.offsetLeft}px, ${n.offsetTop}px)`,e&&J.value.offsetWidth),e&&t.classList.remove(`transition-disabled`)}b([M],()=>{e.type===`segment`&&a(()=>{Y({transitionDisabled:!1})})}),n(()=>{e.type===`segment`&&Y({transitionDisabled:!0})});let ve=0;function ye(t){if(t.contentRect.width===0&&t.contentRect.height===0||ve===t.contentRect.width)return;ve=t.contentRect.width;let{type:n}=e;(n===`line`||n===`bar`)&&(K||e.justifyContent?.startsWith(`space`))&&q(),n!==`segment`&&Q(Te())}let X=Ne(ye,64);function be(){let{type:t}=e;t===`line`||t===`bar`?q():t===`segment`&&Y({transitionDisabled:!0})}b([()=>e.justifyContent,()=>e.size],()=>{a(()=>{(e.type===`line`||e.type===`bar`)&&q()})}),b([d,()=>u?.value],()=>{a(()=>{be(),Q(Te(),{instantly:!0})})}),b(()=>e.type,()=>{a(()=>{let e=_.value;e&&(e.classList.add(`transition-disabled`),be(),e.offsetWidth,e.classList.remove(`transition-disabled`))})});let Z=I(!1);function xe(e){let{target:t,contentRect:{width:n,height:r}}=e,i=t.parentElement.parentElement.offsetWidth,a=t.parentElement.parentElement.offsetHeight,o=d.value;if(!Z.value)o===`top`||o===`bottom`?i<n&&(Z.value=!0):a<r&&(Z.value=!0);else{let{value:e}=S;if(!e)return;o===`top`||o===`bottom`?i-n>e.$el.offsetWidth&&(Z.value=!1):a-r>e.$el.offsetHeight&&(Z.value=!1)}Q(C.value?.$el||null)}let Se=Ne(xe,64);function Ce(){let{onAdd:t}=e;t&&t()}let we=I(!1);function Te(){let e=d.value;return(e===`top`||e===`bottom`?C.value?.$el:w.value)||null}function Q(e,t={instantly:!1}){if(!e)return;let n=t.instantly?x.value:null;n&&n.classList.add(`transition-disabled`);let r=d.value;if(r===`top`||r===`bottom`){let{scrollLeft:t,scrollWidth:n,offsetWidth:r}=e,i=Math.abs(t);T.value=i<=1,E.value=i+r>=n-1,we.value=r<n-1}else{let{scrollTop:t,scrollHeight:n,offsetHeight:r}=e;T.value=t<=1,E.value=t+r>=n-1,we.value=r<n-1}n&&(n.offsetWidth,n.classList.remove(`transition-disabled`))}let De=Ne(e=>{Q(e.target)},64);h(Ee,{triggerRef:P(e,`trigger`),tabStyleRef:P(e,`tabStyle`),tabClassRef:P(e,`tabClass`),addTabStyleRef:P(e,`addTabStyle`),addTabClassRef:P(e,`addTabClass`),paneClassRef:P(e,`paneClass`),paneStyleRef:P(e,`paneStyle`),mergedClsPrefixRef:r,typeRef:P(e,`type`),closableRef:P(e,`closable`),valueRef:M,tabChangeIdRef:F,onBeforeLeaveRef:P(e,`onBeforeLeave`),activateTab:me,handleClose:ge,handleAdd:Ce}),ue(()=>{B(),ie()}),v(()=>{let{value:e}=x;if(!e)return;let{value:t}=r,n=`${t}-tabs-nav-scroll-wrapper--shadow-start`,i=`${t}-tabs-nav-scroll-wrapper--shadow-end`;T.value?e.classList.remove(n):e.classList.add(n),E.value?e.classList.remove(i):e.classList.add(i)});let Oe={syncBarPosition:()=>{B()},scrollToCurrentTab:()=>{ie()}},ke=()=>{Y({transitionDisabled:!0})},Ae=V(()=>{let{value:t}=k,{type:n}=e,r=`${t}${{card:`Card`,bar:`Bar`,line:`Line`,segment:`Segment`}[n]}`,{self:{barColor:i,closeIconColor:a,closeIconColorHover:o,closeIconColorPressed:s,tabColor:c,tabBorderColor:l,paneTextColor:u,tabFontWeight:d,tabBorderRadius:p,tabFontWeightActive:m,colorSegment:h,fontWeightStrong:g,tabColorSegment:_,closeSize:v,closeIconSize:y,closeColorHover:b,closeColorPressed:x,closeBorderRadius:S,[N(`panePadding`,t)]:C,[N(`tabPadding`,r)]:w,[N(`tabPaddingVertical`,r)]:T,[N(`tabGap`,r)]:E,[N(`tabGap`,`${r}Vertical`)]:D,[N(`tabTextColor`,n)]:O,[N(`tabTextColorActive`,n)]:A,[N(`tabTextColorHover`,n)]:j,[N(`tabTextColorDisabled`,n)]:M,[N(`tabFontSize`,t)]:P},common:{cubicBezierEaseInOut:F}}=f.value;return{"--n-bezier":F,"--n-color-segment":h,"--n-bar-color":i,"--n-tab-font-size":P,"--n-tab-text-color":O,"--n-tab-text-color-active":A,"--n-tab-text-color-disabled":M,"--n-tab-text-color-hover":j,"--n-pane-text-color":u,"--n-tab-border-color":l,"--n-tab-border-radius":p,"--n-close-size":v,"--n-close-icon-size":y,"--n-close-color-hover":b,"--n-close-color-pressed":x,"--n-close-border-radius":S,"--n-close-icon-color":a,"--n-close-icon-color-hover":o,"--n-close-icon-color-pressed":s,"--n-tab-color":c,"--n-tab-font-weight":d,"--n-tab-font-weight-active":m,"--n-tab-padding":w,"--n-tab-padding-vertical":T,"--n-tab-gap":E,"--n-tab-gap-vertical":D,"--n-pane-padding-left":U(C,`left`),"--n-pane-padding-right":U(C,`right`),"--n-pane-padding-top":U(C,`top`),"--n-pane-padding-bottom":U(C,`bottom`),"--n-font-weight-strong":g,"--n-tab-color-segment":_}}),$=i?p(`tabs`,V(()=>`${k.value[0]}${e.type[0]}`),Ae,e):void 0;return{mergedClsPrefix:r,mergedValue:M,renderedNames:new Set,segmentCapsuleElRef:J,tabsPaneWrapperRef:H,tabsElRef:g,selfElRef:_,barElRef:y,addTabInstRef:S,xScrollInstRef:C,scrollWrapperElRef:x,addTabFixed:Z,tabWrapperStyle:L,handleNavResize:X,mergedSize:k,handleScroll:De,handleTabsResize:Se,cssVars:i?void 0:Ae,themeClass:$?.themeClass,animationDirection:pe,renderNameListRef:fe,yScrollElRef:w,handleSegmentResize:ke,onAnimationBeforeLeave:se,onAnimationEnter:ce,onAnimationAfterEnter:de,onRender:$?.onRender,startReachedRef:T,endReachedRef:E,isOverflow:we,handleButtonClick:_e,mergedTheme:f,rtlEnabled:u,mergedPlacement:d,...Oe}},render(){let{mergedClsPrefix:e,type:n,mergedPlacement:i,addTabFixed:a,addable:s,mergedSize:c,renderNameListRef:l,onRender:u,paneWrapperClass:f,paneWrapperStyle:p,startReachedRef:m,endReachedRef:h,isOverflow:g,showScrollButton:_,handleButtonClick:v,mergedTheme:y,rtlEnabled:b,$slots:{default:x,prefix:C,suffix:w}}=this;u?.();let T=x?ae(x()).filter(e=>e.type.__TAB_PANE__===!0):[],E=x?ae(x()).filter(e=>e.type.__TAB__===!0):[],O=!E.length,k=n===`card`,A=n===`segment`,N=!k&&!A&&this.justifyContent;l.value=[];let P=()=>{let t=(o(),r(`div`,{style:j(this.tabWrapperStyle),class:L(`${e}-tabs-wrapper`)},[N?z(()=>null):(o(),r(`div`,{key:1,class:L(`${e}-tabs-scroll-padding`),style:j(i===`top`||i===`bottom`?{width:`${this.tabsPadding}px`}:{height:`${this.tabsPadding}px`})},null,6)),O?(o(),r(D,{key:2},[z(()=>T.map((e,t)=>(l.value.push(e.props.name),ze((o(),B($,d(e.props,{internalCreatedByPane:!0,internalLeftPadded:t!==0&&(!N||N===`center`||N===`start`||N===`end`)}),M(e.children?{default:e.children.tab}:void 0),1040,[`internalLeftPadded`]))))))],64)):(o(),r(D,{key:3},[z(()=>E.map((e,t)=>(l.value.push(e.props.name),ze(t!==0&&!N?Re(e):e))))],64)),!a&&s&&k?(o(),r(D,{key:4},[z(()=>Le(s,(O?T.length:E.length)!==0))],64)):z(()=>null),N?z(()=>null):(o(),r(`div`,{key:7,class:L(`${e}-tabs-scroll-padding`),style:j({width:`${this.tabsPadding}px`})},null,6)),k?z(()=>null):(o(),r(`div`,{key:9,ref:`barElRef`,class:L(`${e}-tabs-bar`)},null,2))],6));return o(),r(`div`,{ref:`tabsElRef`,class:L(`${e}-tabs-nav-scroll-content`)},[k&&s?(o(),B(G,{key:0,onResize:this.handleTabsResize},{default:()=>t},1032,[`onResize`])):(o(),r(D,{key:1},[z(()=>t)],64)),k?(o(),r(`div`,{key:2,class:L(`${e}-tabs-pad`)},null,2)):z(()=>null)],2)},F=A?`top`:i;return o(),r(`div`,{ref:`selfElRef`,class:L([`${e}-tabs`,this.themeClass,`${e}-tabs--${n}-type`,`${e}-tabs--${c}-size`,N&&`${e}-tabs--flex`,`${e}-tabs--${F}`,b&&`${e}-tabs--rtl`]),style:j(this.cssVars)},[S(`div`,{class:L([`${e}-tabs-nav--${n}-type`,`${e}-tabs-nav--${F}`,`${e}-tabs-nav`])},[z(()=>t(C,t=>t&&(o(),r(`div`,{class:L(`${e}-tabs-nav__prefix`)},[z(()=>t)],2)))),A?(o(),B(G,{key:0,onResize:this.handleSegmentResize},{default:()=>(o(),r(`div`,{class:L(`${e}-tabs-rail`),ref:`tabsElRef`},[S(`div`,{class:L(`${e}-tabs-capsule`),ref:`segmentCapsuleElRef`},[S(`div`,{class:L(`${e}-tabs-wrapper`)},[S(`div`,{class:L(`${e}-tabs-tab`)},null,2)],2)],2),O?(o(),r(D,{key:0},[z(()=>T.map((e,t)=>(l.value.push(e.props.name),o(),B($,d(e.props,{internalCreatedByPane:!0,internalLeftPadded:t!==0}),M(e.children?{default:e.children.tab}:void 0),1040,[`internalLeftPadded`]))))],64)):(o(),r(D,{key:1},[z(()=>E.map((e,t)=>(l.value.push(e.props.name),t===0?e:Re(e))))],64))],2))},1032,[`onResize`])):(o(),r(D,{key:1},[z(()=>_&&g&&(o(),B(Me,{mergedClsPrefix:e,type:`prev`,vertical:F===`left`||F===`right`,disabled:m,rtl:!!b,theme:y.peers.Button,themeOverrides:y.peerOverrides.Button,onClick:v},null,8,[`mergedClsPrefix`,`vertical`,`disabled`,`rtl`,`theme`,`themeOverrides`,`onClick`]))),(o(),B(G,{onResize:this.handleNavResize},{default:()=>(o(),r(`div`,{class:L(`${e}-tabs-nav-scroll-wrapper`),ref:`scrollWrapperElRef`},[[`top`,`bottom`].includes(F)?(o(),B(Q,{key:0,ref:`xScrollInstRef`,onScroll:this.handleScroll},{default:P},1032,[`onScroll`])):(o(),r(`div`,{key:1,class:L(`${e}-tabs-nav-y-scroll`),onScroll:this.handleScroll,ref:`yScrollElRef`},[z(()=>P())],42,[`onScroll`]))],2))},1032,[`onResize`])),z(()=>_&&g&&(o(),B(Me,{mergedClsPrefix:e,type:`next`,vertical:F===`left`||F===`right`,disabled:h,rtl:!!b,theme:y.peers.Button,themeOverrides:y.peerOverrides.Button,onClick:v},null,8,[`mergedClsPrefix`,`vertical`,`disabled`,`rtl`,`theme`,`themeOverrides`,`onClick`])))],64)),a&&s&&k?(o(),r(D,{key:2},[z(()=>Le(s,!0))],64)):z(()=>null),z(()=>t(w,t=>t&&(o(),r(`div`,{class:L(`${e}-tabs-nav__suffix`)},[z(()=>t)],2))))],2),z(()=>O&&(this.animated&&(F===`top`||F===`bottom`)?(o(),r(`div`,{key:1,ref:`tabsPaneWrapperRef`,style:j(p),class:L([`${e}-tabs-pane-wrapper`,f])},[z(()=>Ie(T,this.mergedValue,this.renderedNames,this.onAnimationBeforeLeave,this.onAnimationEnter,this.onAnimationAfterEnter,this.animationDirection))],6)):Ie(T,this.mergedValue,this.renderedNames)))],6)}});function Ie(e,t,n,r,i,a,s){let c=[];return e.forEach(e=>{let{name:r,displayDirective:i,"display-directive":a}=e.props,o=e=>i===e||a===e,s=t===r;if(e.key!==void 0&&(e.key=r),s||o(`show`)||o(`show:lazy`)&&n.has(r)){n.has(r)||n.add(r);let t=!o(`if`);c.push(t?f(e,[[w,s]]):e)}}),s?(o(),B(C,{name:`${s}-transition`,onBeforeLeave:r,onEnter:i,onAfterEnter:a},{default:()=>c},1032,[`name`,`onBeforeLeave`,`onEnter`,`onAfterEnter`])):c}function Le(e,t){return o(),B($,{ref:`addTabInstRef`,key:`__addable`,name:`__addable`,internalCreatedByPane:!0,internalAddable:!0,internalLeftPadded:t,disabled:typeof e==`object`&&e.disabled},null,8,[`internalLeftPadded`,`disabled`])}function Re(e){let t=ee(e);return t.props?t.props.internalLeftPadded=!0:t.props={internalLeftPadded:!0},t}function ze(e){return Array.isArray(e.dynamicProps)?e.dynamicProps.includes(`internalLeftPadded`)||e.dynamicProps.push(`internalLeftPadded`):e.dynamicProps=[`internalLeftPadded`],e}export{$ as n,Oe as r,Fe as t};