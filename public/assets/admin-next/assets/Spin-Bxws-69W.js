import{Cn as e,Dn as t,Hn as n,L as r,R as i,Xn as a,Xt as o,Zt as s,bn as c,en as l,f as u,ht as d,kn as f,lr as p,nn as m,p as h,rr as g,sn as _,st as v,ut as y,xn as b,yn as x}from"./light-C36WBRZZ.js";import{Vt as S,gt as C,m as w}from"./discrete-BMBIarA6.js";import{v as T}from"./Tooltip-CjyHKpY1.js";var E=o([o(`@keyframes spin-rotate`,`
 from {
 transform: rotate(0);
 }
 to {
 transform: rotate(360deg);
 }
 `),s(`spin-container`,`
 position: relative;
 `,[s(`spin-body`,`
 position: absolute;
 top: 50%;
 left: 50%;
 transform: translateX(-50%) translateY(-50%);
 `,[C()])]),s(`spin-body`,`
 display: inline-flex;
 align-items: center;
 justify-content: center;
 flex-direction: column;
 `),s(`spin`,`
 display: inline-flex;
 height: var(--n-size);
 width: var(--n-size);
 font-size: var(--n-size);
 color: var(--n-color);
 `,[l(`rotate`,`
 animation: spin-rotate 2s linear infinite;
 `)]),s(`spin-description`,`
 display: inline-block;
 font-size: var(--n-font-size);
 color: var(--n-text-color);
 transition: color .3s var(--n-bezier);
 margin-top: 8px;
 `),s(`spin-content`,`
 opacity: 1;
 transition: opacity .3s var(--n-bezier);
 pointer-events: all;
 `,[l(`spinning`,`
 user-select: none;
 -webkit-user-select: none;
 pointer-events: none;
 opacity: var(--n-opacity-spinning);
 `)])]),D={small:20,medium:18,large:16},O={...r.props,contentClass:String,contentStyle:[Object,String],description:String,size:{type:[String,Number],default:`medium`},show:{type:Boolean,default:!0},rotate:{type:Boolean,default:!0},spinning:{type:Boolean,validator:()=>!0,default:void 0},delay:Number,...h,strokeWidth:Number},k=f({name:`Spin`,props:O,slots:Object,setup(e){let{mergedClsPrefixRef:t,inlineThemeDisabled:n}=d(e),o=r(`Spin`,`-spin`,E,w,e,t),s=x(()=>{let{size:t}=e,{common:{cubicBezierEaseInOut:n},self:r}=o.value,{opacitySpinning:i,color:a,textColor:s}=r;return{"--n-bezier":n,"--n-opacity-spinning":i,"--n-size":typeof t==`number`?S(t):r[m(`size`,t)],"--n-color":a,"--n-text-color":s}}),c=n?i(`spin`,x(()=>{let{size:t}=e;return typeof t==`number`?String(t):t[0]}),s,e):void 0,l=T(e,[`spinning`,`show`]),u=g(!1);return a(t=>{let n;if(l.value){let{delay:r}=e;if(r){n=window.setTimeout(()=>{u.value=!0},r),t(()=>{clearTimeout(n)});return}}u.value=l.value}),{mergedClsPrefix:t,active:u,mergedStrokeWidth:x(()=>{let{strokeWidth:t}=e;if(t!==void 0)return t;let{size:n}=e;return D[typeof n==`number`?`medium`:n]}),cssVars:n?void 0:s,themeClass:c?.themeClass,onRender:c?.onRender}},render(){let{$slots:r,mergedClsPrefix:i,description:a}=this,o=r.icon&&this.rotate,s=(a||r.description)&&(n(),e(`div`,{class:v(`${i}-spin-description`)},[y(()=>a||r.description?.())],2)),l=r.icon?(n(),e(`div`,{key:1,class:v([`${i}-spin-body`,this.themeClass])},[c(`div`,{class:v([`${i}-spin`,o&&`${i}-spin--rotate`]),style:p(r.default?``:this.cssVars)},[y(()=>r.icon())],6),y(()=>s)],2)):(n(),e(`div`,{key:2,class:v([`${i}-spin-body`,this.themeClass])},[(n(),b(u,{clsPrefix:i,style:p(r.default?``:this.cssVars),stroke:this.stroke,"stroke-width":this.mergedStrokeWidth,radius:this.radius,scale:this.scale,class:v(`${i}-spin`)},null,8,[`clsPrefix`,`style`,`stroke`,`stroke-width`,`radius`,`scale`,`class`])),y(()=>s)],2));return this.onRender?.(),r.default?(n(),e(`div`,{key:3,class:v([`${i}-spin-container`,this.themeClass]),style:p(this.cssVars)},[c(`div`,{class:v([`${i}-spin-content`,this.active&&`${i}-spin-content--spinning`,this.contentClass]),style:p(this.contentStyle)},[y(()=>r.default?.())],6),t(_,{name:`fade-in-transition`},{default:()=>this.active?l:null},1024)],6)):l}});export{k as t};