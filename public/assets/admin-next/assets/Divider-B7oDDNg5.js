import{$t as e,Cn as t,Hn as n,L as r,R as i,Zt as a,bn as o,en as s,hn as c,ht as l,kn as u,lr as d,st as f,tn as p,ut as m,yn as h}from"./light-C36WBRZZ.js";import{x as g}from"./discrete-BMBIarA6.js";var _=a(`divider`,`
 position: relative;
 display: flex;
 width: 100%;
 box-sizing: border-box;
 font-size: 16px;
 color: var(--n-text-color);
 transition:
 color .3s var(--n-bezier),
 background-color .3s var(--n-bezier);
`,[p(`vertical`,`
 margin-top: 24px;
 margin-bottom: 24px;
 `,[p(`no-title`,`
 display: flex;
 align-items: center;
 `)]),e(`title`,`
 display: flex;
 align-items: center;
 margin-left: 12px;
 margin-right: 12px;
 white-space: nowrap;
 font-weight: var(--n-font-weight);
 `),s(`title-position-left`,[e(`line`,[s(`left`,{width:`28px`})])]),s(`title-position-right`,[e(`line`,[s(`right`,{width:`28px`})])]),s(`dashed`,[e(`line`,`
 background-color: #0000;
 height: 0px;
 width: 100%;
 border-style: dashed;
 border-width: 1px 0 0;
 `)]),s(`vertical`,`
 display: inline-block;
 height: 1em;
 margin: 0 8px;
 vertical-align: middle;
 width: 1px;
 `),e(`line`,`
 border: none;
 transition: background-color .3s var(--n-bezier), border-color .3s var(--n-bezier);
 height: 1px;
 width: 100%;
 margin: 0;
 `),p(`dashed`,[e(`line`,{backgroundColor:`var(--n-color)`})]),s(`dashed`,[e(`line`,{borderColor:`var(--n-color)`})]),s(`vertical`,{backgroundColor:`var(--n-color)`})]),v={...r.props,titlePlacement:{type:String,default:`center`},dashed:Boolean,vertical:Boolean},y=u({name:`Divider`,props:v,setup(e){let{mergedClsPrefixRef:t,inlineThemeDisabled:n}=l(e),a=r(`Divider`,`-divider`,_,g,e,t),o=h(()=>{let{common:{cubicBezierEaseInOut:e},self:{color:t,textColor:n,fontWeight:r}}=a.value;return{"--n-bezier":e,"--n-color":t,"--n-text-color":n,"--n-font-weight":r}}),s=n?i(`divider`,void 0,o,e):void 0;return{mergedClsPrefix:t,cssVars:n?void 0:o,themeClass:s?.themeClass,onRender:s?.onRender}},render(){let{$slots:e,titlePlacement:r,vertical:i,dashed:a,cssVars:s,mergedClsPrefix:l}=this;return this.onRender?.(),n(),t(`div`,{role:`separator`,class:f([`${l}-divider`,this.themeClass,{[`${l}-divider--vertical`]:i,[`${l}-divider--no-title`]:!e.default,[`${l}-divider--dashed`]:a,[`${l}-divider--title-position-${r}`]:e.default&&r}]),style:d(s)},[i?m(()=>null):(n(),t(`div`,{key:0,class:f(`${l}-divider__line ${l}-divider__line--left`)},null,2)),!i&&e.default?(n(),t(c,{key:2},[o(`div`,{class:f(`${l}-divider__title`)},[m(()=>this.$slots.default?.())],2),o(`div`,{class:f(`${l}-divider__line ${l}-divider__line--right`)},null,2)],64)):m(()=>null)],6)}});export{y as t};