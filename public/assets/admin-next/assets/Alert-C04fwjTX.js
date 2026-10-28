import{$t as e,A as t,B as n,Cn as r,F as i,Hn as a,L as o,O as s,Pn as c,R as l,S as u,T as d,V as f,Xt as p,Zt as m,b as h,bn as g,en as _,ht as v,kn as y,nn as b,rr as x,st as S,ut as C,v as w,x as T,xn as E,y as D,yn as O,z as k}from"./light-C36WBRZZ.js";import{Bt as A,it as j,nt as M,rt as N}from"./discrete-BMBIarA6.js";function P(e){let{lineHeight:t,borderRadius:r,fontWeightStrong:i,baseColor:a,dividerColor:o,actionColor:s,textColor1:c,textColor2:l,closeColorHover:u,closeColorPressed:d,closeIconColor:p,closeIconColorHover:m,closeIconColorPressed:h,infoColor:g,successColor:_,warningColor:v,errorColor:y,fontSize:b}=e;return{...N,fontSize:b,lineHeight:t,titleFontWeight:i,borderRadius:r,border:`1px solid ${o}`,color:s,titleTextColor:c,iconColor:l,contentTextColor:l,closeBorderRadius:r,closeColorHover:u,closeColorPressed:d,closeIconColor:p,closeIconColorHover:m,closeIconColorPressed:h,borderInfo:`1px solid ${f(a,n(g,{alpha:.25}))}`,colorInfo:f(a,n(g,{alpha:.08})),titleTextColorInfo:c,iconColorInfo:g,contentTextColorInfo:l,closeColorHoverInfo:u,closeColorPressedInfo:d,closeIconColorInfo:p,closeIconColorHoverInfo:m,closeIconColorPressedInfo:h,borderSuccess:`1px solid ${f(a,n(_,{alpha:.25}))}`,colorSuccess:f(a,n(_,{alpha:.08})),titleTextColorSuccess:c,iconColorSuccess:_,contentTextColorSuccess:l,closeColorHoverSuccess:u,closeColorPressedSuccess:d,closeIconColorSuccess:p,closeIconColorHoverSuccess:m,closeIconColorPressedSuccess:h,borderWarning:`1px solid ${f(a,n(v,{alpha:.33}))}`,colorWarning:f(a,n(v,{alpha:.08})),titleTextColorWarning:c,iconColorWarning:v,contentTextColorWarning:l,closeColorHoverWarning:u,closeColorPressedWarning:d,closeIconColorWarning:p,closeIconColorHoverWarning:m,closeIconColorPressedWarning:h,borderError:`1px solid ${f(a,n(y,{alpha:.25}))}`,colorError:f(a,n(y,{alpha:.08})),titleTextColorError:c,iconColorError:y,contentTextColorError:l,closeColorHoverError:u,closeColorPressedError:d,closeIconColorError:p,closeIconColorHoverError:m,closeIconColorPressedError:h}}var F={name:`Alert`,common:k,self:P},I=m(`alert`,`
 line-height: var(--n-line-height);
 border-radius: var(--n-border-radius);
 position: relative;
 transition: background-color .3s var(--n-bezier);
 background-color: var(--n-color);
 text-align: start;
 word-break: break-word;
`,[e(`border`,`
 border-radius: inherit;
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 bottom: 0;
 transition: border-color .3s var(--n-bezier);
 border: var(--n-border);
 pointer-events: none;
 `),_(`closable`,[m(`alert-body`,[e(`title`,`
 padding-right: 24px;
 `)])]),e(`icon`,{color:`var(--n-icon-color)`}),m(`alert-body`,{padding:`var(--n-padding)`},[e(`title`,{color:`var(--n-title-text-color)`}),e(`content`,{color:`var(--n-content-text-color)`})]),M({originalTransition:`transform .3s var(--n-bezier)`,enterToProps:{transform:`scale(1)`},leaveToProps:{transform:`scale(0.9)`}}),e(`icon`,`
 position: absolute;
 left: 0;
 top: 0;
 align-items: center;
 justify-content: center;
 display: flex;
 width: var(--n-icon-size);
 height: var(--n-icon-size);
 font-size: var(--n-icon-size);
 margin: var(--n-icon-margin);
 `),e(`close`,`
 transition:
 color .3s var(--n-bezier),
 background-color .3s var(--n-bezier);
 position: absolute;
 right: 0;
 top: 0;
 margin: var(--n-close-margin);
 `),_(`show-icon`,[m(`alert-body`,{paddingLeft:`calc(var(--n-icon-margin-left) + var(--n-icon-size) + var(--n-icon-margin-right))`})]),_(`right-adjust`,[m(`alert-body`,{paddingRight:`calc(var(--n-close-size) + var(--n-padding) + 2px)`})]),m(`alert-body`,`
 border-radius: var(--n-border-radius);
 transition: border-color .3s var(--n-bezier);
 `,[e(`title`,`
 transition: color .3s var(--n-bezier);
 font-size: 16px;
 line-height: 19px;
 font-weight: var(--n-title-font-weight);
 `,[p(`& +`,[e(`content`,{marginTop:`9px`})])]),e(`content`,{transition:`color .3s var(--n-bezier)`,fontSize:`var(--n-font-size)`})]),e(`icon`,{transition:`color .3s var(--n-bezier)`})]),L={...o.props,title:String,showIcon:{type:Boolean,default:!0},type:{type:String,default:`default`},bordered:{type:Boolean,default:!0},closable:Boolean,onClose:Function,onAfterLeave:Function,onAfterHide:Function},R=y({name:`Alert`,inheritAttrs:!1,props:L,slots:Object,setup(e){let{mergedClsPrefixRef:t,mergedBorderedRef:n,inlineThemeDisabled:r,mergedRtlRef:i}=v(e),a=o(`Alert`,`-alert`,I,F,e,t),s=d(`Alert`,i,t),c=O(()=>{let{common:{cubicBezierEaseInOut:t},self:n}=a.value,{fontSize:r,borderRadius:i,titleFontWeight:o,lineHeight:s,iconSize:c,iconMargin:l,iconMarginRtl:u,closeIconSize:d,closeBorderRadius:f,closeSize:p,closeMargin:m,closeMarginRtl:h,padding:g}=n,{type:_}=e,{left:v,right:y}=A(l);return{"--n-bezier":t,"--n-color":n[b(`color`,_)],"--n-close-icon-size":d,"--n-close-border-radius":f,"--n-close-color-hover":n[b(`closeColorHover`,_)],"--n-close-color-pressed":n[b(`closeColorPressed`,_)],"--n-close-icon-color":n[b(`closeIconColor`,_)],"--n-close-icon-color-hover":n[b(`closeIconColorHover`,_)],"--n-close-icon-color-pressed":n[b(`closeIconColorPressed`,_)],"--n-icon-color":n[b(`iconColor`,_)],"--n-border":n[b(`border`,_)],"--n-title-text-color":n[b(`titleTextColor`,_)],"--n-content-text-color":n[b(`contentTextColor`,_)],"--n-line-height":s,"--n-border-radius":i,"--n-font-size":r,"--n-title-font-weight":o,"--n-icon-size":c,"--n-icon-margin":l,"--n-icon-margin-rtl":u,"--n-close-size":p,"--n-close-margin":m,"--n-close-margin-rtl":h,"--n-padding":g,"--n-icon-margin-left":v,"--n-icon-margin-right":y}}),u=r?l(`alert`,O(()=>e.type[0]),c,e):void 0,f=x(!0),p=()=>{let{onAfterLeave:t,onAfterHide:n}=e;t&&t(),n&&n()};return{rtlEnabled:s,mergedClsPrefix:t,mergedBordered:n,visible:f,handleCloseClick:()=>{Promise.resolve(e.onClose?.()).then(e=>{e!==!1&&(f.value=!1)})},handleAfterLeave:()=>{p()},mergedTheme:a,cssVars:r?void 0:c,themeClass:u?.themeClass,onRender:u?.onRender}},render(){return this.onRender?.(),a(),E(w,{onAfterLeave:this.handleAfterLeave},{default:()=>{let{mergedClsPrefix:e,$slots:n}=this,o={class:[`${e}-alert`,this.themeClass,this.closable&&`${e}-alert--closable`,this.showIcon&&`${e}-alert--show-icon`,!this.title&&this.closable&&`${e}-alert--right-adjust`,this.rtlEnabled&&`${e}-alert--rtl`],style:this.cssVars,role:`alert`};return this.visible?(a(),r(`div`,c({key:1},c(this.$attrs,o)),[C(()=>this.closable&&(a(),E(j,{clsPrefix:e,class:S(`${e}-alert__close`),onClick:this.handleCloseClick},null,8,[`clsPrefix`,`class`,`onClick`]))),C(()=>this.bordered&&(a(),r(`div`,{class:S(`${e}-alert__border`)},null,2))),C(()=>this.showIcon&&(a(),r(`div`,{class:S(`${e}-alert__icon`),"aria-hidden":`true`},[C(()=>s(n.icon,()=>[(a(),E(i,{clsPrefix:e},{default:()=>{switch(this.type){case`success`:return a(),E(h,{key:3});case`info`:return a(),E(T,{key:4});case`warning`:return a(),E(D,{key:5});case`error`:return a(),E(u,{key:6});default:return null}}},1032,[`clsPrefix`]))]))],2))),g(`div`,{class:S([`${e}-alert-body`,this.mergedBordered&&`${e}-alert-body--bordered`])},[C(()=>t(n.header,t=>{let n=t||this.title;return n?(a(),r(`div`,{key:2,class:S(`${e}-alert-body__title`)},[C(()=>n)],2)):null})),C(()=>n.default&&(a(),r(`div`,{class:S(`${e}-alert-body__content`)},[C(()=>n.default())],2)))],2)],16)):null}},1032,[`onAfterLeave`])}});export{R as t};