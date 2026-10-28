import{$t as e,A as t,Bn as n,Cn as r,Hn as i,L as a,Mn as o,O as s,R as c,Rn as l,Xn as u,Xt as d,Yn as f,Zt as p,d as m,ht as h,in as g,jn as _,kn as v,lr as y,nn as b,rn as x,rr as S,st as C,ut as w,vt as T,w as E,xn as D,yn as O}from"./light-C36WBRZZ.js";import{X as k,lt as A}from"./discrete-BMBIarA6.js";import{a as j}from"./Tooltip-CjyHKpY1.js";var M=m&&`loading`in document.createElement(`img`);function N(e={}){let{root:t=null}=e;return{hash:`${e.rootMargin||`0px 0px 0px 0px`}-${Array.isArray(e.threshold)?e.threshold.join(`,`):e.threshold??`0`}`,options:{...e,root:(typeof t==`string`?document.querySelector(t):t)||document.documentElement}}}var P=new WeakMap,F=new WeakMap,I=new WeakMap,L=(e,t,n)=>{if(!e)return()=>{};let r=N(t),{root:i}=r.options,a,o=P.get(i);o?a=o:(a=new Map,P.set(i,a));let s,c;a.has(r.hash)?(c=a.get(r.hash),c[1].has(e)||(s=c[0],c[1].add(e),s.observe(e))):(s=new IntersectionObserver(e=>{e.forEach(e=>{if(e.isIntersecting){let t=F.get(e.target),n=I.get(e.target);t&&t(),n&&(n.value=!0)}})},r.options),s.observe(e),c=[s,new Set([e])],a.set(r.hash,c));let l=!1,u=()=>{l||(F.delete(e),I.delete(e),l=!0,c[1].has(e)&&(c[0].unobserve(e),c[1].delete(e)),c[1].size<=0&&a.delete(r.hash),a.size||P.delete(i))};return F.set(e,u),I.set(e,n),u},R=T(`n-avatar-group`),z=p(`avatar`,`
 width: var(--n-merged-size);
 height: var(--n-merged-size);
 color: #FFF;
 font-size: var(--n-font-size);
 display: inline-flex;
 position: relative;
 overflow: hidden;
 text-align: center;
 border: var(--n-border);
 border-radius: var(--n-border-radius);
 --n-merged-color: var(--n-color);
 background-color: var(--n-merged-color);
 transition:
 border-color .3s var(--n-bezier),
 background-color .3s var(--n-bezier),
 color .3s var(--n-bezier);
`,[x(d(`&`,`--n-merged-color: var(--n-color-modal);`)),g(d(`&`,`--n-merged-color: var(--n-color-popover);`)),d(`img`,`
 width: 100%;
 height: 100%;
 `),e(`text`,`
 white-space: nowrap;
 display: inline-block;
 position: absolute;
 left: 50%;
 top: 50%;
 `),p(`icon`,`
 vertical-align: bottom;
 font-size: calc(var(--n-merged-size) - 6px);
 `),e(`text`,`line-height: 1.25`)]),B=[`src`],V={...a.props,size:[String,Number],src:String,circle:{type:Boolean,default:void 0},objectFit:String,round:{type:Boolean,default:void 0},bordered:{type:Boolean,default:void 0},onError:Function,fallbackSrc:String,intersectionObserverOptions:Object,lazy:Boolean,onLoad:Function,renderPlaceholder:Function,renderFallback:Function,imgProps:Object,color:String},H=v({name:`Avatar`,props:V,slots:Object,setup(e){let{mergedClsPrefixRef:t,inlineThemeDisabled:r}=h(e),i=S(!1),s=null,d=S(null),p=S(null),m=()=>{let{value:e}=d;if(e&&(s===null||s!==e.innerHTML)){s=e.innerHTML;let{value:t}=p;if(t){let{offsetWidth:n,offsetHeight:r}=t,{offsetWidth:i,offsetHeight:a}=e,o=.9,s=Math.min(n/i*o,r/a*o,1);e.style.transform=`translateX(-50%) translateY(-50%) scale(${s})`}}},g=o(R,null),_=O(()=>{let{size:t}=e;if(t)return t;let{size:n}=g||{};return n||`medium`}),v=a(`Avatar`,`-avatar`,z,k,e,t),y=o(j,null),x=O(()=>{if(g)return!0;let{round:t,circle:n}=e;return t!==void 0||n!==void 0?t||n:y?y.roundRef.value:!1}),C=O(()=>g?!0:e.bordered||!1),w=O(()=>{let t=_.value,n=x.value,r=C.value,{color:i}=e,{self:{borderRadius:a,fontSize:o,color:s,border:c,colorModal:l,colorPopover:u},common:{cubicBezierEaseInOut:d}}=v.value,f;return f=typeof t==`number`?`${t}px`:v.value.self[b(`height`,t)],{"--n-font-size":o,"--n-border":r?c:`none`,"--n-border-radius":n?`50%`:a,"--n-color":i||s,"--n-color-modal":i||l,"--n-color-popover":i||u,"--n-bezier":d,"--n-merged-size":`var(--n-avatar-size-override, ${f})`}}),T=r?c(`avatar`,O(()=>{let t=_.value,n=x.value,r=C.value,{color:i}=e,a=``;return t&&(a+=typeof t==`number`?`a${t}`:t[0]),n&&(a+=`b`),r&&(a+=`c`),i&&(a+=E(i)),a}),w,e):void 0,D=S(!e.lazy);n(()=>{if(e.lazy&&e.intersectionObserverOptions){let t,n=u(()=>{t?.(),t=void 0,e.lazy&&(t=L(p.value,e.intersectionObserverOptions,D))});l(()=>{n(),t?.()})}}),f(()=>e.src||e.imgProps?.src,()=>{i.value=!1});let A=S(!e.lazy);return{textRef:d,selfRef:p,mergedRoundRef:x,mergedClsPrefix:t,fitTextTransform:m,cssVars:r?void 0:w,themeClass:T?.themeClass,onRender:T?.onRender,hasLoadError:i,shouldStartLoading:D,loaded:A,mergedOnError:t=>{if(!D.value)return;i.value=!0;let{onError:n,imgProps:{onError:r}={}}=e;n?.(t),r?.(t)},mergedOnLoad:t=>{let{onLoad:n,imgProps:{onLoad:r}={}}=e;n?.(t),r?.(t),A.value=!0}}},render(){let{$slots:e,src:n,mergedClsPrefix:a,lazy:o,onRender:c,loaded:l,hasLoadError:u,imgProps:d={}}=this;c?.();let f,p=!l&&!u&&(this.renderPlaceholder?this.renderPlaceholder():this.$slots.placeholder?.());return f=this.hasLoadError?this.renderFallback?this.renderFallback():s(e.fallback,()=>[(i(),r(`img`,{src:this.fallbackSrc,style:y({objectFit:this.objectFit})},null,12,B))]):t(e.default,e=>{if(e)return i(),D(A,{key:1,onResize:this.fitTextTransform},{default:()=>(i(),r(`span`,{ref:`textRef`,class:C(`${a}-avatar__text`)},[w(()=>e)],2))},1032,[`onResize`]);if(n||d.src){let e=this.src||d.src;return _(`img`,{...d,loading:M&&!this.intersectionObserverOptions&&o?`lazy`:`eager`,src:o&&this.intersectionObserverOptions?this.shouldStartLoading?e:void 0:e,"data-image-src":e,onLoad:this.mergedOnLoad,onError:this.mergedOnError,style:[d.style||``,{objectFit:this.objectFit},p?{height:`0`,width:`0`,visibility:`hidden`,position:`absolute`}:``]})}}),i(),r(`span`,{ref:`selfRef`,class:C([`${a}-avatar`,this.themeClass]),style:y(this.cssVars)},[w(()=>f),w(()=>o&&p)],6)}});export{H as t};