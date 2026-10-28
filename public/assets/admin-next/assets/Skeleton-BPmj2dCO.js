import{Cn as e,Hn as t,L as n,Pn as r,Xt as i,Zt as a,d as o,hn as s,ht as c,jn as l,kn as u,nn as d,ut as f,yn as p,z as m}from"./light-C36WBRZZ.js";import{Lt as h,Vt as g}from"./discrete-BMBIarA6.js";var _=!1;function v(){if(o&&window.CSS&&!_&&(_=!0,`registerProperty`in window?.CSS))try{CSS.registerProperty({name:`--n-color-start`,syntax:`<color>`,inherits:!1,initialValue:`#0000`}),CSS.registerProperty({name:`--n-color-end`,syntax:`<color>`,inherits:!1,initialValue:`#0000`})}catch{}}function y(e){let{heightSmall:t,heightMedium:n,heightLarge:r,borderRadius:i}=e;return{color:`#eee`,colorEnd:`#ddd`,borderRadius:i,heightSmall:t,heightMedium:n,heightLarge:r}}var b={name:`Skeleton`,common:m,self:y},x=i([a(`skeleton`,`
 height: 1em;
 width: 100%;
 transition:
 --n-color-start .3s var(--n-bezier),
 --n-color-end .3s var(--n-bezier),
 background-color .3s var(--n-bezier);
 animation: 2s skeleton-loading infinite cubic-bezier(0.36, 0, 0.64, 1);
 background-color: var(--n-color-start);
 `),i(`@keyframes skeleton-loading`,`
 0% {
 background: var(--n-color-start);
 }
 40% {
 background: var(--n-color-end);
 }
 80% {
 background: var(--n-color-start);
 }
 100% {
 background: var(--n-color-start);
 }
 `)]),S={...n.props,text:Boolean,round:Boolean,circle:Boolean,height:[String,Number],width:[String,Number],size:String,repeat:{type:Number,default:1},animated:{type:Boolean,default:!0},sharp:{type:Boolean,default:!0}},C=u({name:`Skeleton`,inheritAttrs:!1,props:S,setup(e){v();let{mergedClsPrefixRef:t,mergedComponentPropsRef:r}=c(e),i=p(()=>e.size||r?.value?.Skeleton?.size),a=n(`Skeleton`,`-skeleton`,x,b,e,t);return{mergedClsPrefix:t,style:p(()=>{let t=a.value,{common:{cubicBezierEaseInOut:n}}=t,r=t.self,{color:o,colorEnd:s,borderRadius:c}=r,l,{circle:u,sharp:f,round:p,width:m,height:h,text:_,animated:v}=e,y=i.value;y!==void 0&&(l=r[d(`height`,y)]);let b=u?m??h??l:m,x=(u?m??h:h)??l;return{display:_?`inline-block`:``,verticalAlign:_?`-0.125em`:``,borderRadius:u?`50%`:p?`4096px`:f?``:c,width:typeof b==`number`?g(b):b,height:typeof x==`number`?g(x):x,animation:v?``:`none`,"--n-bezier":n,"--n-color-start":o,"--n-color-end":s}})}},render(){let{repeat:n,style:i,mergedClsPrefix:a,$attrs:o}=this,c=l(`div`,r({class:`${a}-skeleton`,style:i},o));return n>1?(t(),e(s,{key:1},[f(()=>h(n,null).map(e=>[c,`
`]))],64)):c}});export{C as t};