import{Cn as e,F as t,Hn as n,L as r,R as i,S as a,Xt as o,Zt as s,b as c,bn as l,en as u,hn as d,ht as f,kn as p,lr as m,lt as h,nn as g,on as _,st as v,ut as y,x as b,xn as x,y as S,yn as C}from"./light-C36WBRZZ.js";import{o as w}from"./_plugin-vue_export-helper-Y2v3pMRv.js";import{h as T}from"./discrete-BMBIarA6.js";var E=[`id`],D=[`stop-color`],O=[`stop-color`],k=[`viewBox`],A=[`d`,`stroke-width`],j=[`d`,`stroke-width`],M={success:(n(),x(c)),error:(n(),x(a)),warning:(n(),x(S)),info:(n(),x(b))},N=p({name:`ProgressCircle`,props:{clsPrefix:{type:String,required:!0},status:{type:String,required:!0},strokeWidth:{type:Number,required:!0},fillColor:[String,Object],railColor:String,railStyle:[String,Object],percentage:{type:Number,default:0},offsetDegree:{type:Number,default:0},showIndicator:{type:Boolean,required:!0},indicatorTextColor:String,unit:String,viewBoxWidth:{type:Number,required:!0},gapDegree:{type:Number,required:!0},gapOffsetDegree:{type:Number,default:0}},setup(r,{slots:i}){let a=C(()=>{let e=`gradient`,{fillColor:t}=r;return typeof t==`object`?`${e}-${_(JSON.stringify(t))}`:e});function o(e,t,n,i){let{gapDegree:o,viewBoxWidth:s,strokeWidth:c}=r,l=50+c/2,u=`M ${l},${l} m 0,50
      a 50,50 0 1 1 0,-100
      a 50,50 0 1 1 0,100`,d=Math.PI*2*50;return{pathString:u,pathStyle:{stroke:i===`rail`?n:typeof r.fillColor==`object`?`url(#${a.value})`:n,strokeDasharray:`${Math.min(e,100)/100*(d-o)}px ${s*8}px`,strokeDashoffset:`-${o/2}px`,transformOrigin:t?`center`:void 0,transform:t?`rotate(${t}deg)`:void 0}}}let s=()=>{let t=typeof r.fillColor==`object`,i=t?r.fillColor.stops[0]:``,o=t?r.fillColor.stops[1]:``;return t&&(n(),e(`defs`,null,[l(`linearGradient`,{id:a.value,x1:`0%`,y1:`100%`,x2:`100%`,y2:`0%`},[l(`stop`,{offset:`0%`,"stop-color":i},null,8,D),l(`stop`,{offset:`100%`,"stop-color":o},null,8,O)],8,E)]))};return()=>{let{fillColor:a,railColor:c,strokeWidth:u,offsetDegree:f,status:p,percentage:h,showIndicator:g,indicatorTextColor:_,unit:b,gapOffsetDegree:S,clsPrefix:C}=r,{pathString:w,pathStyle:T}=o(100,0,c,`rail`),{pathString:E,pathStyle:D}=o(h,f,a,`fill`),O=100+u;return n(),e(`div`,{class:v(`${C}-progress-content`),role:`none`},[l(`div`,{class:v(`${C}-progress-graph`),"aria-hidden":!0},[l(`div`,{class:v(`${C}-progress-graph-circle`),style:m({transform:S?`rotate(${S}deg)`:void 0})},[(n(),e(`svg`,{viewBox:`0 0 ${O} ${O}`},[y(()=>s()),l(`g`,null,[l(`path`,{class:v(`${C}-progress-graph-circle-rail`),d:w,"stroke-width":u,"stroke-linecap":`round`,fill:`none`,style:m(T)},null,14,A)]),l(`g`,null,[l(`path`,{class:v([`${C}-progress-graph-circle-fill`,h===0&&`${C}-progress-graph-circle-fill--empty`]),d:E,"stroke-width":u,"stroke-linecap":`round`,fill:`none`,style:m(D)},null,14,j)])],8,k))],6)],2),g?(n(),e(`div`,{key:0},[i.default?(n(),e(`div`,{key:0,class:v(`${C}-progress-custom-content`),role:`none`},[y(()=>i.default())],2)):(n(),e(d,{key:1},[p==="default"?(n(),e(`div`,{key:1,class:v(`${C}-progress-text`),style:m({color:_}),role:`none`},[l(`span`,{class:v(`${C}-progress-text__percentage`)},[y(()=>h)],2),l(`span`,{class:v(`${C}-progress-text__unit`)},[y(()=>b)],2)],6)):(n(),e(`div`,{key:0,class:v(`${C}-progress-icon`),"aria-hidden":!0},[(n(),x(t,{clsPrefix:C},{default:()=>M[p]},1032,[`clsPrefix`]))],2))],64))])):y(()=>null)],2)}}}),P={success:(n(),x(c)),error:(n(),x(a)),warning:(n(),x(S)),info:(n(),x(b))},F=p({name:`ProgressLine`,props:{clsPrefix:{type:String,required:!0},percentage:{type:Number,default:0},railColor:String,railStyle:[String,Object],fillColor:[String,Object],status:{type:String,required:!0},indicatorPlacement:{type:String,required:!0},indicatorTextColor:String,unit:{type:String,default:`%`},processing:{type:Boolean,required:!0},showIndicator:{type:Boolean,required:!0},height:[String,Number],railBorderRadius:[String,Number],fillBorderRadius:[String,Number]},setup(r,{slots:i}){let a=C(()=>w(r.height)),o=C(()=>typeof r.fillColor==`object`?`linear-gradient(to right, ${r.fillColor?.stops[0]} , ${r.fillColor?.stops[1]})`:r.fillColor),s=C(()=>r.railBorderRadius===void 0?r.height===void 0?``:w(r.height,{c:.5}):w(r.railBorderRadius)),c=C(()=>r.fillBorderRadius===void 0?r.railBorderRadius===void 0?r.height===void 0?``:w(r.height,{c:.5}):w(r.railBorderRadius):w(r.fillBorderRadius));return()=>{let{indicatorPlacement:u,railColor:f,railStyle:p,percentage:h,unit:g,indicatorTextColor:_,status:b,showIndicator:S,processing:C,clsPrefix:w}=r;return n(),e(`div`,{class:v(`${w}-progress-content`),role:`none`},[l(`div`,{class:v(`${w}-progress-graph`),"aria-hidden":!0},[l(`div`,{class:v([`${w}-progress-graph-line`,{[`${w}-progress-graph-line--indicator-${u}`]:!0}])},[l(`div`,{class:v(`${w}-progress-graph-line-rail`),style:m([{backgroundColor:f,height:a.value,borderRadius:s.value},p])},[l(`div`,{class:v([`${w}-progress-graph-line-fill`,C&&`${w}-progress-graph-line-fill--processing`]),style:m({maxWidth:`${r.percentage}%`,background:o.value,height:a.value,lineHeight:a.value,borderRadius:c.value})},[u===`inside`?(n(),e(`div`,{key:0,class:v(`${w}-progress-graph-line-indicator`),style:m({color:_})},[i.default?(n(),e(d,{key:0},[y(()=>i.default())],64)):(n(),e(d,{key:1},[y(()=>`${h}${g}`)],64))],6)):y(()=>null)],6)],6)],2)],2),S&&u===`outside`?(n(),e(`div`,{key:0},[i.default?(n(),e(`div`,{key:0,class:v(`${w}-progress-custom-content`),style:m({color:_}),role:`none`},[y(()=>i.default())],6)):(n(),e(d,{key:1},[b==="default"?(n(),e(`div`,{key:0,role:`none`,class:v(`${w}-progress-icon ${w}-progress-icon--as-text`),style:m({color:_})},[y(()=>h),y(()=>g)],6)):(n(),e(`div`,{key:1,class:v(`${w}-progress-icon`),"aria-hidden":!0},[(n(),x(t,{clsPrefix:w},{default:()=>P[b]},1032,[`clsPrefix`]))],2))],64))])):y(()=>null)],2)}}}),I=[`id`],L=[`stop-color`],R=[`stop-color`],z=[`d`,`stroke-width`],B=[`d`,`stroke-width`],V=[`viewBox`];function H(e,t,n=100){return`m ${n/2} ${n/2-e} a ${e} ${e} 0 1 1 0 ${2*e} a ${e} ${e} 0 1 1 0 -${2*e}`}var U=p({name:`ProgressMultipleCircle`,props:{clsPrefix:{type:String,required:!0},viewBoxWidth:{type:Number,required:!0},percentage:{type:Array,default:[0]},strokeWidth:{type:Number,required:!0},circleGap:{type:Number,required:!0},showIndicator:{type:Boolean,required:!0},fillColor:{type:Array,default:()=>[]},railColor:{type:Array,default:()=>[]},railStyle:{type:Array,default:()=>[]}},setup(t,{slots:r}){let i=C(()=>t.percentage.map((e,n)=>`${Math.PI*e/100*(t.viewBoxWidth/2-t.strokeWidth/2*(1+2*n)-t.circleGap*n)*2}, ${t.viewBoxWidth*8}`)),a=(r,i)=>{let a=t.fillColor[i],o=typeof a==`object`?a.stops[0]:``,s=typeof a==`object`?a.stops[1]:``;return typeof t.fillColor[i]==`object`&&(n(),e(`linearGradient`,{id:`gradient-${i}`,x1:`100%`,y1:`0%`,x2:`0%`,y2:`100%`},[l(`stop`,{offset:`0%`,"stop-color":o},null,8,L),l(`stop`,{offset:`100%`,"stop-color":s},null,8,R)],8,I))};return()=>{let{viewBoxWidth:o,strokeWidth:s,circleGap:c,showIndicator:u,fillColor:d,railColor:f,railStyle:p,percentage:h,clsPrefix:g}=t;return n(),e(`div`,{class:v(`${g}-progress-content`),role:`none`},[l(`div`,{class:v(`${g}-progress-graph`),"aria-hidden":!0},[l(`div`,{class:v(`${g}-progress-graph-circle`)},[(n(),e(`svg`,{viewBox:`0 0 ${o} ${o}`},[l(`defs`,null,[y(()=>h.map((e,t)=>a(e,t)))]),y(()=>h.map((t,r)=>(n(),e(`g`,{key:r},[l(`path`,{class:v(`${g}-progress-graph-circle-rail`),d:H(o/2-s/2*(1+2*r)-c*r,s,o),"stroke-width":s,"stroke-linecap":`round`,fill:`none`,style:m([{strokeDashoffset:0,stroke:f[r]},p[r]])},null,14,z),l(`path`,{class:v([`${g}-progress-graph-circle-fill`,t===0&&`${g}-progress-graph-circle-fill--empty`]),d:H(o/2-s/2*(1+2*r)-c*r,s,o),"stroke-width":s,"stroke-linecap":`round`,fill:`none`,style:m({strokeDasharray:i.value[r],strokeDashoffset:0,stroke:typeof d[r]==`object`?`url(#gradient-${r})`:d[r]})},null,14,B)]))))],8,V))],2)],2),u&&r.default?(n(),e(`div`,{key:0},[l(`div`,{class:v(`${g}-progress-text`)},[y(()=>r.default())],2)])):y(()=>null)],2)}}}),W=o([s(`progress`,{display:`inline-block`},[s(`progress-icon`,`
 color: var(--n-icon-color);
 transition: color .3s var(--n-bezier);
 `),u(`line`,`
 width: 100%;
 display: block;
 `,[s(`progress-content`,`
 display: flex;
 align-items: center;
 `,[s(`progress-graph`,{flex:1})]),s(`progress-custom-content`,{marginLeft:`14px`}),s(`progress-icon`,`
 width: 30px;
 padding-left: 14px;
 height: var(--n-icon-size-line);
 line-height: var(--n-icon-size-line);
 font-size: var(--n-icon-size-line);
 `,[u(`as-text`,`
 color: var(--n-text-color-line-outer);
 text-align: center;
 width: 40px;
 font-size: var(--n-font-size);
 padding-left: 4px;
 transition: color .3s var(--n-bezier);
 `)])]),u(`circle, dashboard`,{width:`120px`},[s(`progress-custom-content`,`
 position: absolute;
 left: 50%;
 top: 50%;
 transform: translateX(-50%) translateY(-50%);
 display: flex;
 align-items: center;
 justify-content: center;
 `),s(`progress-text`,`
 position: absolute;
 left: 50%;
 top: 50%;
 transform: translateX(-50%) translateY(-50%);
 display: flex;
 align-items: center;
 color: inherit;
 font-size: var(--n-font-size-circle);
 color: var(--n-text-color-circle);
 font-weight: var(--n-font-weight-circle);
 transition: color .3s var(--n-bezier);
 white-space: nowrap;
 `),s(`progress-icon`,`
 position: absolute;
 left: 50%;
 top: 50%;
 transform: translateX(-50%) translateY(-50%);
 display: flex;
 align-items: center;
 color: var(--n-icon-color);
 font-size: var(--n-icon-size-circle);
 `)]),u(`multiple-circle`,`
 width: 200px;
 color: inherit;
 `,[s(`progress-text`,`
 font-weight: var(--n-font-weight-circle);
 color: var(--n-text-color-circle);
 position: absolute;
 left: 50%;
 top: 50%;
 transform: translateX(-50%) translateY(-50%);
 display: flex;
 align-items: center;
 justify-content: center;
 transition: color .3s var(--n-bezier);
 `)]),s(`progress-content`,{position:`relative`}),s(`progress-graph`,{position:`relative`},[s(`progress-graph-circle`,[o(`svg`,{verticalAlign:`bottom`}),s(`progress-graph-circle-fill`,`
 stroke: var(--n-fill-color);
 transition:
 opacity .3s var(--n-bezier),
 stroke .3s var(--n-bezier),
 stroke-dasharray .3s var(--n-bezier);
 `,[u(`empty`,{opacity:0})]),s(`progress-graph-circle-rail`,`
 transition: stroke .3s var(--n-bezier);
 overflow: hidden;
 stroke: var(--n-rail-color);
 `)]),s(`progress-graph-line`,[u(`indicator-inside`,[s(`progress-graph-line-rail`,`
 height: 16px;
 line-height: 16px;
 border-radius: 10px;
 `,[s(`progress-graph-line-fill`,`
 height: inherit;
 border-radius: 10px;
 `),s(`progress-graph-line-indicator`,`
 background: #0000;
 white-space: nowrap;
 text-align: right;
 margin-left: 14px;
 margin-right: 14px;
 height: inherit;
 font-size: 12px;
 color: var(--n-text-color-line-inner);
 transition: color .3s var(--n-bezier);
 `)])]),u(`indicator-inside-label`,`
 height: 16px;
 display: flex;
 align-items: center;
 `,[s(`progress-graph-line-rail`,`
 flex: 1;
 transition: background-color .3s var(--n-bezier);
 `),s(`progress-graph-line-indicator`,`
 background: var(--n-fill-color);
 font-size: 12px;
 transform: translateZ(0);
 display: flex;
 vertical-align: middle;
 height: 16px;
 line-height: 16px;
 padding: 0 10px;
 border-radius: 10px;
 position: absolute;
 white-space: nowrap;
 color: var(--n-text-color-line-inner);
 transition:
 right .2s var(--n-bezier),
 color .3s var(--n-bezier),
 background-color .3s var(--n-bezier);
 `)]),s(`progress-graph-line-rail`,`
 position: relative;
 overflow: hidden;
 height: var(--n-rail-height);
 border-radius: 5px;
 background-color: var(--n-rail-color);
 transition: background-color .3s var(--n-bezier);
 `,[s(`progress-graph-line-fill`,`
 background: var(--n-fill-color);
 position: relative;
 border-radius: 5px;
 height: inherit;
 width: 100%;
 max-width: 0%;
 transition:
 background-color .3s var(--n-bezier),
 max-width .2s var(--n-bezier);
 `,[u(`processing`,[o(`&::after`,`
 content: "";
 background-image: var(--n-line-bg-processing);
 animation: progress-processing-animation 2s var(--n-bezier) infinite;
 `)])])])])])]),o(`@keyframes progress-processing-animation`,`
 0% {
 position: absolute;
 left: 0;
 top: 0;
 bottom: 0;
 right: 100%;
 opacity: 1;
 }
 66% {
 position: absolute;
 left: 0;
 top: 0;
 bottom: 0;
 right: 0;
 opacity: 0;
 }
 100% {
 position: absolute;
 left: 0;
 top: 0;
 bottom: 0;
 right: 0;
 opacity: 0;
 }
 `)]),G=[`aria-valuenow`,`role`],K={...r.props,processing:Boolean,type:{type:String,default:`line`},gapDegree:Number,gapOffsetDegree:Number,status:{type:String,default:`default`},railColor:[String,Array],railStyle:[String,Array],color:[String,Array,Object],viewBoxWidth:{type:Number,default:100},strokeWidth:{type:Number,default:7},percentage:[Number,Array],unit:{type:String,default:`%`},showIndicator:{type:Boolean,default:!0},indicatorPosition:{type:String,default:`outside`},indicatorPlacement:{type:String,default:`outside`},indicatorTextColor:String,circleGap:{type:Number,default:1},height:Number,borderRadius:[String,Number],fillBorderRadius:[String,Number],offsetDegree:Number},q=p({name:`Progress`,props:K,setup(e){let t=C(()=>e.indicatorPlacement||e.indicatorPosition),n=C(()=>{if(e.gapDegree||e.gapDegree===0)return e.gapDegree;if(e.type===`dashboard`)return 75}),{mergedClsPrefixRef:a,inlineThemeDisabled:o}=f(e),s=r(`Progress`,`-progress`,W,T,e,a),c=C(()=>{let{status:t}=e,{common:{cubicBezierEaseInOut:n},self:{fontSize:r,fontSizeCircle:i,railColor:a,railHeight:o,iconSizeCircle:c,iconSizeLine:l,textColorCircle:u,textColorLineInner:d,textColorLineOuter:f,lineBgProcessing:p,fontWeightCircle:m,[g(`iconColor`,t)]:h,[g(`fillColor`,t)]:_}}=s.value;return{"--n-bezier":n,"--n-fill-color":_,"--n-font-size":r,"--n-font-size-circle":i,"--n-font-weight-circle":m,"--n-icon-color":h,"--n-icon-size-circle":c,"--n-icon-size-line":l,"--n-line-bg-processing":p,"--n-rail-color":a,"--n-rail-height":o,"--n-text-color-circle":u,"--n-text-color-line-inner":d,"--n-text-color-line-outer":f}}),l=o?i(`progress`,C(()=>e.status[0]),c,e):void 0;return{mergedClsPrefix:a,mergedIndicatorPlacement:t,gapDeg:n,cssVars:o?void 0:c,themeClass:l?.themeClass,onRender:l?.onRender}},render(){let{type:t,cssVars:r,indicatorTextColor:i,showIndicator:a,status:o,railColor:s,railStyle:c,color:l,percentage:u,viewBoxWidth:f,strokeWidth:p,mergedIndicatorPlacement:g,unit:_,borderRadius:b,fillBorderRadius:S,height:C,processing:w,circleGap:T,mergedClsPrefix:E,gapDeg:D,gapOffsetDegree:O,themeClass:k,$slots:A,onRender:j}=this;return j?.(),n(),e(`div`,{class:v([k,`${E}-progress`,`${E}-progress--${t}`,`${E}-progress--${o}`]),style:m(r),"aria-valuemax":100,"aria-valuemin":0,"aria-valuenow":u,role:t===`circle`||t===`line`||t===`dashboard`?`progressbar`:`none`},[t===`circle`||t===`dashboard`?(n(),x(N,{key:0,clsPrefix:E,status:o,showIndicator:a,indicatorTextColor:i,railColor:s,fillColor:l,railStyle:c,offsetDegree:this.offsetDegree,percentage:u,viewBoxWidth:f,strokeWidth:p,gapDegree:D===void 0?t===`dashboard`?75:0:D,gapOffsetDegree:O,unit:_},h(A),1032,[`clsPrefix`,`status`,`showIndicator`,`indicatorTextColor`,`railColor`,`fillColor`,`railStyle`,`offsetDegree`,`percentage`,`viewBoxWidth`,`strokeWidth`,`gapDegree`,`gapOffsetDegree`,`unit`])):(n(),e(d,{key:1},[t===`line`?(n(),x(F,{key:0,clsPrefix:E,status:o,showIndicator:a,indicatorTextColor:i,railColor:s,fillColor:l,railStyle:c,percentage:u,processing:w,indicatorPlacement:g,unit:_,fillBorderRadius:S,railBorderRadius:b,height:C},h(A),1032,[`clsPrefix`,`status`,`showIndicator`,`indicatorTextColor`,`railColor`,`fillColor`,`railStyle`,`percentage`,`processing`,`indicatorPlacement`,`unit`,`fillBorderRadius`,`railBorderRadius`,`height`])):(n(),e(d,{key:1},[t===`multiple-circle`?(n(),x(U,{key:0,clsPrefix:E,strokeWidth:p,railColor:s,fillColor:l,railStyle:c,viewBoxWidth:f,percentage:u,showIndicator:a,circleGap:T},h(A),1032,[`clsPrefix`,`strokeWidth`,`railColor`,`fillColor`,`railStyle`,`viewBoxWidth`,`percentage`,`showIndicator`,`circleGap`])):y(()=>null)],64))],64))],14,G)}});export{q as t};