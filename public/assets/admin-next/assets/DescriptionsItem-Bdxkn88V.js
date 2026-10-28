import{$t as e,Cn as t,Hn as n,L as r,R as i,Xt as a,Zt as o,bn as s,en as c,ht as l,in as u,kn as d,lr as f,nn as p,rn as m,st as h,tn as g,ut as _,yn as v}from"./light-C36WBRZZ.js";import{Lt as y,O as b,St as x}from"./discrete-BMBIarA6.js";import{v as S}from"./Tooltip-CjyHKpY1.js";import{t as C}from"./get-slot-D_YJaz3e.js";function w(e,t=`default`,n=[]){let{children:r}=e;if(typeof r==`object`&&r&&!Array.isArray(r)){let e=r[t];if(typeof e==`function`)return e()}return n}var T=a([o(`descriptions`,{fontSize:`var(--n-font-size)`},[o(`descriptions-separator`,`
 display: inline-block;
 margin: 0 8px 0 2px;
 `),o(`descriptions-table-wrapper`,[o(`descriptions-table`,[o(`descriptions-table-row`,[o(`descriptions-table-header`,{padding:`var(--n-th-padding)`}),o(`descriptions-table-content`,{padding:`var(--n-td-padding)`})])])]),g(`bordered`,[o(`descriptions-table-wrapper`,[o(`descriptions-table`,[o(`descriptions-table-row`,[a(`&:last-child`,[o(`descriptions-table-content`,{paddingBottom:0})])])])])]),c(`left-label-placement`,[o(`descriptions-table-content`,[a(`> *`,{verticalAlign:`top`})])]),c(`left-label-align`,[a(`th`,{textAlign:`left`})]),c(`center-label-align`,[a(`th`,{textAlign:`center`})]),c(`right-label-align`,[a(`th`,{textAlign:`right`})]),c(`bordered`,[o(`descriptions-table-wrapper`,`
 border-radius: var(--n-border-radius);
 overflow: hidden;
 background: var(--n-merged-td-color);
 border: 1px solid var(--n-merged-border-color);
 `,[o(`descriptions-table`,[o(`descriptions-table-row`,[a(`&:not(:last-child)`,[o(`descriptions-table-content`,{borderBottom:`1px solid var(--n-merged-border-color)`}),o(`descriptions-table-header`,{borderBottom:`1px solid var(--n-merged-border-color)`})]),o(`descriptions-table-header`,`
 font-weight: 400;
 background-clip: padding-box;
 background-color: var(--n-merged-th-color);
 `,[a(`&:not(:last-child)`,{borderRight:`1px solid var(--n-merged-border-color)`})]),o(`descriptions-table-content`,[a(`&:not(:last-child)`,{borderRight:`1px solid var(--n-merged-border-color)`})])])])])]),o(`descriptions-header`,`
 font-weight: var(--n-th-font-weight);
 font-size: 18px;
 transition: color .3s var(--n-bezier);
 line-height: var(--n-line-height);
 margin-bottom: 16px;
 color: var(--n-title-text-color);
 `),o(`descriptions-table-wrapper`,`
 transition:
 background-color .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
 `,[o(`descriptions-table`,`
 width: 100%;
 border-collapse: separate;
 border-spacing: 0;
 box-sizing: border-box;
 `,[o(`descriptions-table-row`,`
 box-sizing: border-box;
 transition: border-color .3s var(--n-bezier);
 `,[o(`descriptions-table-header`,`
 font-weight: var(--n-th-font-weight);
 line-height: var(--n-line-height);
 display: table-cell;
 box-sizing: border-box;
 color: var(--n-th-text-color);
 transition:
 color .3s var(--n-bezier),
 background-color .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
 `),o(`descriptions-table-content`,`
 vertical-align: top;
 line-height: var(--n-line-height);
 display: table-cell;
 box-sizing: border-box;
 color: var(--n-td-text-color);
 transition:
 color .3s var(--n-bezier),
 background-color .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
 `,[e(`content`,`
 transition: color .3s var(--n-bezier);
 display: inline-block;
 color: var(--n-td-text-color);
 `)]),e(`label`,`
 font-weight: var(--n-th-font-weight);
 transition: color .3s var(--n-bezier);
 display: inline-block;
 margin-right: 14px;
 color: var(--n-th-text-color);
 `)])])])]),o(`descriptions-table-wrapper`,`
 --n-merged-th-color: var(--n-th-color);
 --n-merged-td-color: var(--n-td-color);
 --n-merged-border-color: var(--n-border-color);
 `),m(o(`descriptions-table-wrapper`,`
 --n-merged-th-color: var(--n-th-color-modal);
 --n-merged-td-color: var(--n-td-color-modal);
 --n-merged-border-color: var(--n-border-color-modal);
 `)),u(o(`descriptions-table-wrapper`,`
 --n-merged-th-color: var(--n-th-color-popover);
 --n-merged-td-color: var(--n-td-color-popover);
 --n-merged-border-color: var(--n-border-color-popover);
 `))]),E=`DESCRIPTION_ITEM_FLAG`;function D(e){return typeof e==`object`&&e&&!Array.isArray(e)?e.type&&e.type.DESCRIPTION_ITEM_FLAG:!1}var O=[`colspan`],k=[`colspan`],A=[`colspan`],j=[`colspan`],M={...r.props,title:String,column:{type:Number,default:3},columns:Number,labelPlacement:{type:String,default:`top`},labelAlign:{type:String,default:`left`},separator:{type:String,default:`:`},size:String,bordered:Boolean,labelClass:String,labelStyle:[Object,String],contentClass:String,contentStyle:[Object,String]},N=d({name:`Descriptions`,props:M,slots:Object,setup(e){let{mergedClsPrefixRef:t,inlineThemeDisabled:n,mergedComponentPropsRef:a}=l(e),o=v(()=>e.size||a?.value?.Descriptions?.size||`medium`),s=r(`Descriptions`,`-descriptions`,T,b,e,t),c=v(()=>{let{bordered:t}=e,n=o.value,{common:{cubicBezierEaseInOut:r},self:{titleTextColor:i,thColor:a,thColorModal:c,thColorPopover:l,thTextColor:u,thFontWeight:d,tdTextColor:f,tdColor:m,tdColorModal:h,tdColorPopover:g,borderColor:_,borderColorModal:v,borderColorPopover:y,borderRadius:b,lineHeight:x,[p(`fontSize`,n)]:S,[p(t?`thPaddingBordered`:`thPadding`,n)]:C,[p(t?`tdPaddingBordered`:`tdPadding`,n)]:w}}=s.value;return{"--n-title-text-color":i,"--n-th-padding":C,"--n-td-padding":w,"--n-font-size":S,"--n-bezier":r,"--n-th-font-weight":d,"--n-line-height":x,"--n-th-text-color":u,"--n-td-text-color":f,"--n-th-color":a,"--n-th-color-modal":c,"--n-th-color-popover":l,"--n-td-color":m,"--n-td-color-modal":h,"--n-td-color-popover":g,"--n-border-radius":b,"--n-border-color":_,"--n-border-color-modal":v,"--n-border-color-popover":y}}),u=n?i(`descriptions`,v(()=>{let t=``,{bordered:n}=e;return n&&(t+=`a`),t+=o.value[0],t}),c,e):void 0;return{mergedClsPrefix:t,cssVars:n?void 0:c,themeClass:u?.themeClass,onRender:u?.onRender,compitableColumn:S(e,[`columns`,`column`]),inlineThemeDisabled:n,mergedSize:o}},render(){let e=this.$slots.default,r=e?x(e()):[];r.length;let{contentClass:i,labelClass:a,compitableColumn:o,labelPlacement:c,labelAlign:l,mergedSize:u,bordered:d,title:p,cssVars:m,mergedClsPrefix:g,separator:v,onRender:b}=this;b?.();let S=r.filter(e=>D(e)),T=S.reduce((e,r,l)=>{let u=r.props||{},p=S.length-1===l,m=[`label`in u?u.label:w(r,`label`)],y=[w(r)],b=u.span||1,x=e.span;e.span+=b;let C=u.labelStyle||u[`label-style`]||this.labelStyle,T=u.contentStyle||u[`content-style`]||this.contentStyle;if(c===`left`)d?e.row.push((n(),t(`th`,{key:1,class:h([`${g}-descriptions-table-header`,a]),colspan:1,style:f(C)},[_(()=>m)],6)),(n(),t(`td`,{key:2,class:h([`${g}-descriptions-table-content`,i]),colspan:p?(o-x)*2+1:b*2-1,style:f(T)},[_(()=>y)],14,O))):e.row.push((n(),t(`td`,{key:3,class:h(`${g}-descriptions-table-content`),colspan:p?(o-x)*2:b*2},[s(`span`,{class:h([`${g}-descriptions-table-content__label`,a]),style:f(C)},[_(()=>[...m,v&&(n(),t(`span`,{key:4,class:h(`${g}-descriptions-separator`)},[_(()=>v)],2))])],6),s(`span`,{class:h([`${g}-descriptions-table-content__content`,i]),style:f(T)},[_(()=>y)],6)],10,k)));else{let r=p?(o-x)*2:b*2;e.row.push((n(),t(`th`,{key:5,class:h([`${g}-descriptions-table-header`,a]),colspan:r,style:f(C)},[_(()=>m)],14,A))),e.secondRow.push((n(),t(`td`,{key:6,class:h([`${g}-descriptions-table-content`,i]),colspan:r,style:f(T)},[_(()=>y)],14,j)))}return(e.span>=o||p)&&(e.span=0,e.row.length&&(e.rows.push(e.row),e.row=[]),c!==`left`&&e.secondRow.length&&(e.rows.push(e.secondRow),e.secondRow=[])),e},{span:0,row:[],secondRow:[],rows:[]}).rows.map(e=>(n(),t(`tr`,{class:h(`${g}-descriptions-table-row`)},[_(()=>e)],2)));return n(),t(`div`,{style:f(m),class:h([`${g}-descriptions`,this.themeClass,`${g}-descriptions--${c}-label-placement`,`${g}-descriptions--${l}-label-align`,`${g}-descriptions--${u}-size`,d&&`${g}-descriptions--bordered`])},[p||this.$slots.header?(n(),t(`div`,{key:0,class:h(`${g}-descriptions-header`)},[_(()=>p||C(this,`header`))],2)):_(()=>null),s(`div`,{class:h(`${g}-descriptions-table-wrapper`)},[s(`table`,{class:h(`${g}-descriptions-table`)},[s(`tbody`,null,[_(()=>c===`top`&&(n(),t(`tr`,{class:h(`${g}-descriptions-table-row`),style:{visibility:`collapse`}},[_(()=>y(o*2,(n(),t(`td`))))],2))),_(()=>T)])],2)],2)],6)}}),P={label:String,span:{type:Number,default:1},labelClass:String,labelStyle:[Object,String],contentClass:String,contentStyle:[Object,String]},F=d({name:`DescriptionsItem`,[E]:!0,props:P,slots:Object,render(){return null}});export{N as n,F as t};