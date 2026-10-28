import{$t as e,Cn as t,Hn as n,L as r,M as i,Mn as a,N as o,Pn as s,Qn as c,R as l,Rn as u,T as d,Un as f,Xn as p,Xt as m,Yn as h,Zt as g,bn as _,dn as v,en as y,hn as b,ht as x,jn as S,kn as C,lr as w,lt as T,or as E,pt as D,rr as O,sn as k,st as A,ut as j,xn as M,yn as N,yt as P}from"./light-C36WBRZZ.js";import{o as F,s as I}from"./_plugin-vue_export-helper-Y2v3pMRv.js";import{At as L,D as R,Ot as ee,W as z,Y as B,b as V,ct as H,dt as U,ft as W,gt as G,it as K,jt as q,kt as J,ot as Y,pt as X}from"./discrete-BMBIarA6.js";var Z=[`onMouseenter`,`onMouseleave`,`onMousedown`],Q={key:1,role:`none`},te=C({name:`NDrawerContent`,inheritAttrs:!1,props:{blockScroll:Boolean,show:{type:Boolean,default:void 0},displayDirective:{type:String,required:!0},placement:{type:String,required:!0},contentClass:String,contentStyle:[Object,String],nativeScrollbar:{type:Boolean,required:!0},scrollbarProps:Object,trapFocus:{type:Boolean,default:!0},autoFocus:{type:Boolean,default:!0},showMask:{type:[Boolean,String],required:!0},maxWidth:Number,maxHeight:Number,minWidth:Number,minHeight:Number,resizable:Boolean,onClickoutside:Function,onAfterLeave:Function,onAfterEnter:Function,onEsc:Function},setup(e){let t=O(!!e.show),n=O(null),r=a(q),i=0,o=``,s=null,c=O(!1),l=O(!1),m=N(()=>e.placement===`top`||e.placement===`bottom`),{mergedClsPrefixRef:g,mergedRtlRef:_}=x(e),y=d(`Drawer`,_,g),b=j,S=e=>{l.value=!0,i=m.value?e.clientY:e.clientX,o=document.body.style.cursor,document.body.style.cursor=m.value?`ns-resize`:`ew-resize`,document.body.addEventListener(`mousemove`,A),document.body.addEventListener(`mouseleave`,b),document.body.addEventListener(`mouseup`,j)},C=()=>{s!==null&&(window.clearTimeout(s),s=null),l.value?c.value=!0:s=window.setTimeout(()=>{c.value=!0},300)},w=()=>{s!==null&&(window.clearTimeout(s),s=null),c.value=!1},{doUpdateHeight:T,doUpdateWidth:E}=r,D=t=>{let{maxWidth:n}=e;if(n&&t>n)return n;let{minWidth:r}=e;return r&&t<r?r:t},k=t=>{let{maxHeight:n}=e;if(n&&t>n)return n;let{minHeight:r}=e;return r&&t<r?r:t};function A(t){if(l.value){if(m.value){let r=n.value?.offsetHeight||0,a=i-t.clientY;r+=e.placement===`bottom`?a:-a,r=k(r),T(r),i=t.clientY}else{let r=n.value?.offsetWidth||0,a=i-t.clientX;r+=e.placement===`right`?a:-a,r=D(r),E(r),i=t.clientX}}}function j(){l.value&&(i=0,l.value=!1,document.body.style.cursor=o,document.body.removeEventListener(`mousemove`,A),document.body.removeEventListener(`mouseup`,j),document.body.removeEventListener(`mouseleave`,b))}p(()=>{e.show&&(t.value=!0)}),h(()=>e.show,e=>{e||j()}),u(()=>{j()});let M=N(()=>{let{show:t}=e,n=[[v,t]];return e.showMask||n.push([X,e.onClickoutside,void 0,{capture:!0}]),n});function P(){t.value=!1,e.onAfterLeave?.()}return B(N(()=>e.blockScroll&&t.value)),f(L,n),f(ee,null),f(J,null),{bodyRef:n,rtlEnabled:y,mergedClsPrefix:r.mergedClsPrefixRef,isMounted:r.isMountedRef,mergedTheme:r.mergedThemeRef,displayed:t,transitionName:N(()=>({right:`slide-in-from-right-transition`,left:`slide-in-from-left-transition`,top:`slide-in-from-top-transition`,bottom:`slide-in-from-bottom-transition`})[e.placement]),handleAfterLeave:P,bodyDirectives:M,handleMousedownResizeTrigger:S,handleMouseenterResizeTrigger:C,handleMouseleaveResizeTrigger:w,isDragging:l,isHoverOnResizeTrigger:c}},render(){let{$slots:e,mergedClsPrefix:r}=this;return this.displayDirective===`show`||this.displayed||this.show?c((n(),t(`div`,Q,[(n(),M(H,{disabled:!this.showMask||!this.trapFocus,active:this.show,autoFocus:this.autoFocus,onEsc:this.onEsc},{default:()=>(n(),M(k,{name:this.transitionName,appear:this.isMounted,onAfterEnter:this.onAfterEnter,onAfterLeave:this.handleAfterLeave},{default:()=>c(S(`div`,s(this.$attrs,{role:`dialog`,ref:`bodyRef`,"aria-modal":`true`,class:[`${r}-drawer`,this.rtlEnabled&&`${r}-drawer--rtl`,`${r}-drawer--${this.placement}-placement`,this.isDragging&&`${r}-drawer--unselectable`,this.nativeScrollbar&&`${r}-drawer--native-scrollbar`]}),[this.resizable?(n(),t(`div`,{key:2,class:A([`${r}-drawer__resize-trigger`,(this.isDragging||this.isHoverOnResizeTrigger)&&`${r}-drawer__resize-trigger--hover`]),onMouseenter:this.handleMouseenterResizeTrigger,onMouseleave:this.handleMouseleaveResizeTrigger,onMousedown:this.handleMousedownResizeTrigger},null,42,Z)):null,this.nativeScrollbar?(n(),t(`div`,{key:3,class:A([`${r}-drawer-content-wrapper`,this.contentClass]),style:w(this.contentStyle),role:`none`},[j(()=>e.default?.())],6)):(n(),M(Y,s({key:4},this.scrollbarProps,{contentStyle:this.contentStyle,contentClass:[`${r}-drawer-content-wrapper`,this.contentClass],theme:this.mergedTheme.peers.Scrollbar,themeOverrides:this.mergedTheme.peerOverrides.Scrollbar}),T(e),1040,[`contentStyle`,`contentClass`,`theme`,`themeOverrides`]))]),this.bodyDirectives)},1032,[`name`,`appear`,`onAfterEnter`,`onAfterLeave`]))},1032,[`disabled`,`active`,`autoFocus`,`onEsc`]))])),[[v,this.displayDirective===`if`||this.displayed||this.show]]):null}}),{cubicBezierEaseIn:ne,cubicBezierEaseOut:re}=D;function ie({duration:e=`0.3s`,leaveDuration:t=`0.2s`,name:n=`slide-in-from-bottom`}={}){return[m(`&.${n}-transition-leave-active`,{transition:`transform ${t} ${ne}`}),m(`&.${n}-transition-enter-active`,{transition:`transform ${e} ${re}`}),m(`&.${n}-transition-enter-to`,{transform:`translateY(0)`}),m(`&.${n}-transition-enter-from`,{transform:`translateY(100%)`}),m(`&.${n}-transition-leave-from`,{transform:`translateY(0)`}),m(`&.${n}-transition-leave-to`,{transform:`translateY(100%)`})]}var{cubicBezierEaseIn:ae,cubicBezierEaseOut:oe}=D;function se({duration:e=`0.3s`,leaveDuration:t=`0.2s`,name:n=`slide-in-from-left`}={}){return[m(`&.${n}-transition-leave-active`,{transition:`transform ${t} ${ae}`}),m(`&.${n}-transition-enter-active`,{transition:`transform ${e} ${oe}`}),m(`&.${n}-transition-enter-to`,{transform:`translateX(0)`}),m(`&.${n}-transition-enter-from`,{transform:`translateX(-100%)`}),m(`&.${n}-transition-leave-from`,{transform:`translateX(0)`}),m(`&.${n}-transition-leave-to`,{transform:`translateX(-100%)`})]}var{cubicBezierEaseIn:ce,cubicBezierEaseOut:le}=D;function ue({duration:e=`0.3s`,leaveDuration:t=`0.2s`,name:n=`slide-in-from-right`}={}){return[m(`&.${n}-transition-leave-active`,{transition:`transform ${t} ${ce}`}),m(`&.${n}-transition-enter-active`,{transition:`transform ${e} ${le}`}),m(`&.${n}-transition-enter-to`,{transform:`translateX(0)`}),m(`&.${n}-transition-enter-from`,{transform:`translateX(100%)`}),m(`&.${n}-transition-leave-from`,{transform:`translateX(0)`}),m(`&.${n}-transition-leave-to`,{transform:`translateX(100%)`})]}var{cubicBezierEaseIn:de,cubicBezierEaseOut:fe}=D;function pe({duration:e=`0.3s`,leaveDuration:t=`0.2s`,name:n=`slide-in-from-top`}={}){return[m(`&.${n}-transition-leave-active`,{transition:`transform ${t} ${de}`}),m(`&.${n}-transition-enter-active`,{transition:`transform ${e} ${fe}`}),m(`&.${n}-transition-enter-to`,{transform:`translateY(0)`}),m(`&.${n}-transition-enter-from`,{transform:`translateY(-100%)`}),m(`&.${n}-transition-leave-from`,{transform:`translateY(0)`}),m(`&.${n}-transition-leave-to`,{transform:`translateY(-100%)`})]}var $=m([g(`drawer`,`
 word-break: break-word;
 line-height: var(--n-line-height);
 position: absolute;
 pointer-events: all;
 box-shadow: var(--n-box-shadow);
 transition:
 background-color .3s var(--n-bezier),
 color .3s var(--n-bezier);
 background-color: var(--n-color);
 color: var(--n-text-color);
 box-sizing: border-box;
 `,[ue(),se(),pe(),ie(),y(`unselectable`,`
 user-select: none; 
 -webkit-user-select: none;
 `),y(`native-scrollbar`,[g(`drawer-content-wrapper`,`
 overflow: auto;
 height: 100%;
 `)]),e(`resize-trigger`,`
 position: absolute;
 background-color: #0000;
 transition: background-color .3s var(--n-bezier);
 `,[y(`hover`,`
 background-color: var(--n-resize-trigger-color-hover);
 `)]),g(`drawer-content-wrapper`,`
 box-sizing: border-box;
 `),g(`drawer-content`,`
 height: 100%;
 display: flex;
 flex-direction: column;
 `,[y(`native-scrollbar`,[g(`drawer-body-content-wrapper`,`
 height: 100%;
 overflow: auto;
 `)]),g(`drawer-body`,`
 flex: 1 0 0;
 overflow: hidden;
 `),g(`drawer-body-content-wrapper`,`
 box-sizing: border-box;
 padding: var(--n-body-padding);
 `),g(`drawer-header`,`
 font-weight: var(--n-title-font-weight);
 line-height: 1;
 font-size: var(--n-title-font-size);
 color: var(--n-title-text-color);
 padding: var(--n-header-padding);
 transition: border .3s var(--n-bezier);
 border-bottom: 1px solid var(--n-divider-color);
 border-bottom: var(--n-header-border-bottom);
 display: flex;
 justify-content: space-between;
 align-items: center;
 `,[e(`main`,`
 flex: 1;
 `),e(`close`,`
 margin-left: 6px;
 transition:
 background-color .3s var(--n-bezier),
 color .3s var(--n-bezier);
 `)]),g(`drawer-footer`,`
 display: flex;
 justify-content: flex-end;
 border-top: var(--n-footer-border-top);
 transition: border .3s var(--n-bezier);
 padding: var(--n-footer-padding);
 `)]),y(`right-placement`,`
 top: 0;
 bottom: 0;
 right: 0;
 border-top-left-radius: var(--n-border-radius);
 border-bottom-left-radius: var(--n-border-radius);
 `,[e(`resize-trigger`,`
 width: 3px;
 height: 100%;
 top: 0;
 left: 0;
 transform: translateX(-1.5px);
 cursor: ew-resize;
 `)]),y(`left-placement`,`
 top: 0;
 bottom: 0;
 left: 0;
 border-top-right-radius: var(--n-border-radius);
 border-bottom-right-radius: var(--n-border-radius);
 `,[e(`resize-trigger`,`
 width: 3px;
 height: 100%;
 top: 0;
 right: 0;
 transform: translateX(1.5px);
 cursor: ew-resize;
 `)]),y(`top-placement`,`
 top: 0;
 left: 0;
 right: 0;
 border-bottom-left-radius: var(--n-border-radius);
 border-bottom-right-radius: var(--n-border-radius);
 `,[e(`resize-trigger`,`
 width: 100%;
 height: 3px;
 bottom: 0;
 left: 0;
 transform: translateY(1.5px);
 cursor: ns-resize;
 `)]),y(`bottom-placement`,`
 left: 0;
 bottom: 0;
 right: 0;
 border-top-left-radius: var(--n-border-radius);
 border-top-right-radius: var(--n-border-radius);
 `,[e(`resize-trigger`,`
 width: 100%;
 height: 3px;
 top: 0;
 left: 0;
 transform: translateY(-1.5px);
 cursor: ns-resize;
 `)])]),m(`body`,[m(`>`,[g(`drawer-container`,`
 position: fixed;
 `)])]),g(`drawer-container`,`
 position: relative;
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 bottom: 0;
 pointer-events: none;
 `,[m(`> *`,`
 pointer-events: all;
 `)]),g(`drawer-mask`,`
 background-color: rgba(0, 0, 0, .3);
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 bottom: 0;
 `,[y(`invisible`,`
 background-color: rgba(0, 0, 0, 0)
 `),G({enterDuration:`0.2s`,leaveDuration:`0.2s`,enterCubicBezier:`var(--n-bezier-in)`,leaveCubicBezier:`var(--n-bezier-out)`})])]),me=[`onClick`],he={...r.props,show:Boolean,width:[Number,String],height:[Number,String],placement:{type:String,default:`right`},maskClosable:{type:Boolean,default:!0},showMask:{type:[Boolean,String],default:!0},to:[String,Object],displayDirective:{type:String,default:`if`},nativeScrollbar:{type:Boolean,default:!0},zIndex:Number,onMaskClick:Function,scrollbarProps:Object,contentClass:String,contentStyle:[Object,String],trapFocus:{type:Boolean,default:!0},onEsc:Function,autoFocus:{type:Boolean,default:!0},closeOnEsc:{type:Boolean,default:!0},blockScroll:{type:Boolean,default:!0},maxWidth:Number,maxHeight:Number,minWidth:Number,minHeight:Number,resizable:Boolean,defaultWidth:{type:[Number,String],default:251},defaultHeight:{type:[Number,String],default:251},onUpdateWidth:[Function,Array],onUpdateHeight:[Function,Array],"onUpdate:width":[Function,Array],"onUpdate:height":[Function,Array],"onUpdate:show":[Function,Array],onUpdateShow:[Function,Array],onAfterEnter:Function,onAfterLeave:Function,drawerStyle:[String,Object],drawerClass:String,target:null,onShow:Function,onHide:Function},ge=C({name:`Drawer`,inheritAttrs:!1,props:he,setup(e){let{mergedClsPrefixRef:t,namespaceRef:n,inlineThemeDisabled:a}=x(e),s=o(),c=r(`Drawer`,`-drawer`,$,V,e,t),u=O(e.defaultWidth),d=O(e.defaultHeight),p=I(E(e,`width`),u),m=I(E(e,`height`),d),h=N(()=>{let{placement:t}=e;return t===`top`||t===`bottom`?``:F(p.value)}),g=N(()=>{let{placement:t}=e;return t===`left`||t===`right`?``:F(m.value)}),_=t=>{let{onUpdateWidth:n,"onUpdate:width":r}=e;n&&i(n,t),r&&i(r,t),u.value=t},v=t=>{let{onUpdateHeight:n,"onUpdate:width":r}=e;n&&i(n,t),r&&i(r,t),d.value=t},y=N(()=>[{width:h.value,height:g.value},e.drawerStyle||``]);function b(t){let{onMaskClick:n,maskClosable:r}=e;r&&T(!1),n&&n(t)}function S(e){b(e)}let C=R();function w(t){e.onEsc?.(),e.show&&e.closeOnEsc&&z(t)&&(C.value||T(!1))}function T(t){let{onHide:n,onUpdateShow:r,"onUpdate:show":a}=e;r&&i(r,t),a&&i(a,t),n&&!t&&i(n,t)}f(q,{isMountedRef:s,mergedThemeRef:c,mergedClsPrefixRef:t,doUpdateShow:T,doUpdateHeight:v,doUpdateWidth:_});let D=N(()=>{let{common:{cubicBezierEaseInOut:e,cubicBezierEaseIn:t,cubicBezierEaseOut:n},self:{color:r,textColor:i,boxShadow:a,lineHeight:o,headerPadding:s,footerPadding:l,borderRadius:u,bodyPadding:d,titleFontSize:f,titleTextColor:p,titleFontWeight:m,headerBorderBottom:h,footerBorderTop:g,closeIconColor:_,closeIconColorHover:v,closeIconColorPressed:y,closeColorHover:b,closeColorPressed:x,closeIconSize:S,closeSize:C,closeBorderRadius:w,resizableTriggerColorHover:T}}=c.value;return{"--n-line-height":o,"--n-color":r,"--n-border-radius":u,"--n-text-color":i,"--n-box-shadow":a,"--n-bezier":e,"--n-bezier-out":n,"--n-bezier-in":t,"--n-header-padding":s,"--n-body-padding":d,"--n-footer-padding":l,"--n-title-text-color":p,"--n-title-font-size":f,"--n-title-font-weight":m,"--n-header-border-bottom":h,"--n-footer-border-top":g,"--n-close-icon-color":_,"--n-close-icon-color-hover":v,"--n-close-icon-color-pressed":y,"--n-close-size":C,"--n-close-color-hover":b,"--n-close-color-pressed":x,"--n-close-icon-size":S,"--n-close-border-radius":w,"--n-resize-trigger-color-hover":T}}),k=a?l(`drawer`,void 0,D,e):void 0;return{mergedClsPrefix:t,namespace:n,mergedBodyStyle:y,handleOutsideClick:S,handleMaskClick:b,handleEsc:w,mergedTheme:c,cssVars:a?void 0:D,themeClass:k?.themeClass,onRender:k?.onRender,isMounted:s}},render(){let{mergedClsPrefix:e}=this;return n(),M(U,{to:this.to,show:this.show},{default:()=>(this.onRender?.(),c((n(),t(`div`,{class:A([`${e}-drawer-container`,this.namespace,this.themeClass]),style:w(this.cssVars),role:`none`},[this.showMask?(n(),M(k,{key:0,name:`fade-in-transition`,appear:this.isMounted},{default:()=>this.show?(n(),t(`div`,{key:1,"aria-hidden":!0,class:A([`${e}-drawer-mask`,this.showMask===`transparent`&&`${e}-drawer-mask--invisible`]),onClick:this.handleMaskClick},null,10,me)):null},1032,[`appear`])):j(()=>null),(n(),M(te,s(this.$attrs,{class:[this.drawerClass,this.$attrs.class],style:[this.mergedBodyStyle,this.$attrs.style],blockScroll:this.blockScroll,contentStyle:this.contentStyle,contentClass:this.contentClass,placement:this.placement,scrollbarProps:this.scrollbarProps,show:this.show,displayDirective:this.displayDirective,nativeScrollbar:this.nativeScrollbar,onAfterEnter:this.onAfterEnter,onAfterLeave:this.onAfterLeave,trapFocus:this.trapFocus,autoFocus:this.autoFocus,resizable:this.resizable,maxHeight:this.maxHeight,minHeight:this.minHeight,maxWidth:this.maxWidth,minWidth:this.minWidth,showMask:this.showMask,onEsc:this.handleEsc,onClickoutside:this.handleOutsideClick}),T(this.$slots),1040,[`class`,`style`,`blockScroll`,`contentStyle`,`contentClass`,`placement`,`scrollbarProps`,`show`,`displayDirective`,`nativeScrollbar`,`onAfterEnter`,`onAfterLeave`,`trapFocus`,`autoFocus`,`resizable`,`maxHeight`,`minHeight`,`maxWidth`,`minWidth`,`showMask`,`onEsc`,`onClickoutside`]))],6)),[[W,{zIndex:this.zIndex,enabled:this.show}]]))},1032,[`to`,`show`])}}),_e=C({name:`DrawerContent`,props:{title:String,headerClass:String,headerStyle:[Object,String],footerClass:String,footerStyle:[Object,String],bodyClass:String,bodyStyle:[Object,String],bodyContentClass:String,bodyContentStyle:[Object,String],nativeScrollbar:{type:Boolean,default:!0},scrollbarProps:Object,closable:Boolean},slots:Object,setup(){let e=a(q,null);e||P(`drawer-content`,"`n-drawer-content` must be placed inside `n-drawer`.");let{doUpdateShow:t}=e;function n(){t(!1)}return{handleCloseClick:n,mergedTheme:e.mergedThemeRef,mergedClsPrefix:e.mergedClsPrefixRef}},render(){let{title:e,mergedClsPrefix:r,nativeScrollbar:i,mergedTheme:a,bodyClass:o,bodyStyle:c,bodyContentClass:l,bodyContentStyle:u,headerClass:d,headerStyle:f,footerClass:p,footerStyle:m,scrollbarProps:h,closable:g,$slots:v}=this;return n(),t(`div`,{role:`none`,class:A([`${r}-drawer-content`,i&&`${r}-drawer-content--native-scrollbar`])},[v.header||e||g?(n(),t(`div`,{key:0,class:A([`${r}-drawer-header`,d]),style:w(f),role:`none`},[_(`div`,{class:A(`${r}-drawer-header__main`),role:`heading`,"aria-level":`1`},[v.header===void 0?(n(),t(b,{key:1},[j(()=>e)],64)):(n(),t(b,{key:0},[j(()=>v.header())],64))],2),j(()=>g&&(n(),M(K,{onClick:this.handleCloseClick,clsPrefix:r,class:A(`${r}-drawer-header__close`),absolute:!0},null,8,[`onClick`,`clsPrefix`,`class`])))],6)):j(()=>null),i?(n(),t(`div`,{key:2,class:A([`${r}-drawer-body`,o]),style:w(c),role:`none`},[_(`div`,{class:A([`${r}-drawer-body-content-wrapper`,l]),style:w(u),role:`none`},[j(()=>v.default?.())],6)],6)):(n(),M(Y,s({key:3,themeOverrides:a.peerOverrides.Scrollbar,theme:a.peers.Scrollbar},h,{class:`${r}-drawer-body`,contentClass:[`${r}-drawer-body-content-wrapper`,l],contentStyle:u}),T(v),1040,[`themeOverrides`,`theme`,`class`,`contentClass`,`contentStyle`])),v.footer?(n(),t(`div`,{key:4,class:A([`${r}-drawer-footer`,p]),style:w(m),role:`none`},[j(()=>v.footer())],6)):j(()=>null)],2)}});export{ge as n,_e as t};