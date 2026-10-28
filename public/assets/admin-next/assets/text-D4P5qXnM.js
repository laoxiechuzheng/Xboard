import{Cn as e,Hn as t,L as n,R as r,Zt as i,en as a,hn as o,ht as s,jn as c,kn as l,lr as u,nn as d,st as f,ut as p,yn as m}from"./light-C36WBRZZ.js";import{d as h}from"./discrete-BMBIarA6.js";import{v as g}from"./Tooltip-CjyHKpY1.js";var _=i(`text`,`
 transition: color .3s var(--n-bezier);
 color: var(--n-text-color);
`,[a(`strong`,`
 font-weight: var(--n-font-weight-strong);
 `),a(`italic`,{fontStyle:`italic`}),a(`underline`,{textDecoration:`underline`}),a(`code`,`
 line-height: 1.4;
 display: inline-block;
 font-family: var(--n-font-famliy-mono);
 transition: 
 color .3s var(--n-bezier),
 border-color .3s var(--n-bezier),
 background-color .3s var(--n-bezier);
 box-sizing: border-box;
 padding: .05em .35em 0 .35em;
 border-radius: var(--n-code-border-radius);
 font-size: .9em;
 color: var(--n-code-text-color);
 background-color: var(--n-code-color);
 border: var(--n-code-border);
 `)]),v={...n.props,code:Boolean,type:{type:String,default:`default`},delete:Boolean,strong:Boolean,italic:Boolean,underline:Boolean,depth:[String,Number],tag:String,as:{type:String,validator:()=>!0,default:void 0}},y=l({name:`Text`,props:v,setup(e){let{mergedClsPrefixRef:t,inlineThemeDisabled:i}=s(e),a=n(`Typography`,`-text`,_,h,e,t),o=m(()=>{let{depth:t,type:n}=e,r=n==="default"?t===void 0?`textColor`:`textColor${t}Depth`:d(`textColor`,n),{common:{fontWeightStrong:i,fontFamilyMono:o,cubicBezierEaseInOut:s},self:{codeTextColor:c,codeBorderRadius:l,codeColor:u,codeBorder:f,[r]:p}}=a.value;return{"--n-bezier":s,"--n-text-color":p,"--n-font-weight-strong":i,"--n-font-famliy-mono":o,"--n-code-border-radius":l,"--n-code-text-color":c,"--n-code-color":u,"--n-code-border":f}}),c=i?r(`text`,m(()=>`${e.type[0]}${e.depth||``}`),o,e):void 0;return{mergedClsPrefix:t,compitableTag:g(e,[`as`,`tag`]),cssVars:i?void 0:o,themeClass:c?.themeClass,onRender:c?.onRender}},render(){let{mergedClsPrefix:n}=this;this.onRender?.();let r=[`${n}-text`,this.themeClass,{[`${n}-text--code`]:this.code,[`${n}-text--delete`]:this.delete,[`${n}-text--strong`]:this.strong,[`${n}-text--italic`]:this.italic,[`${n}-text--underline`]:this.underline}],i=this.$slots.default?.();return this.code?(t(),e(`code`,{key:1,class:f(r),style:u(this.cssVars)},[this.delete?(t(),e(`del`,{key:0},[p(()=>i)])):(t(),e(o,{key:1},[p(()=>i)],64))],6)):this.delete?(t(),e(`del`,{key:2,class:f(r),style:u(this.cssVars)},[p(()=>i)],6)):c(this.compitableTag||`span`,{class:r,style:this.cssVars},i)}});export{y as t};