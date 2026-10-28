import{$t as e,A as t,B as n,Cn as r,D as i,Hn as a,L as o,M as s,Pn as c,R as l,Xt as u,Zt as d,_ as f,bn as p,en as m,f as h,h as g,ht as _,kn as v,lr as y,m as b,nn as x,or as S,rr as C,st as w,tn as T,ut as E,xn as D,yn as O,z as k}from"./light-C36WBRZZ.js";import{s as A}from"./_plugin-vue_export-helper-Y2v3pMRv.js";import{Rt as j,Vt as M,p as N}from"./discrete-BMBIarA6.js";function P(e){let{primaryColor:t,opacityDisabled:r,borderRadius:i,textColor3:a}=e;return{...N,iconColor:a,textColor:`white`,loadingColor:t,opacityDisabled:r,railColor:`rgba(0, 0, 0, .14)`,railColorActive:t,buttonBoxShadow:`0 1px 4px 0 rgba(0, 0, 0, 0.3), inset 0 0 1px 0 rgba(0, 0, 0, 0.05)`,buttonColor:`#FFF`,railBorderRadiusSmall:i,railBorderRadiusMedium:i,railBorderRadiusLarge:i,buttonBorderRadiusSmall:i,buttonBorderRadiusMedium:i,buttonBorderRadiusLarge:i,boxShadowFocus:`0 0 0 2px ${n(t,{alpha:.2})}`}}var F={name:`Switch`,common:k,self:P},I=d(`switch`,`
 height: var(--n-height);
 min-width: var(--n-width);
 vertical-align: middle;
 user-select: none;
 -webkit-user-select: none;
 display: inline-flex;
 outline: none;
 justify-content: center;
 align-items: center;
`,[e(`children-placeholder`,`
 height: var(--n-rail-height);
 display: flex;
 flex-direction: column;
 overflow: hidden;
 pointer-events: none;
 visibility: hidden;
 `),e(`rail-placeholder`,`
 display: flex;
 flex-wrap: none;
 `),e(`button-placeholder`,`
 width: calc(1.75 * var(--n-rail-height));
 height: var(--n-rail-height);
 `),d(`base-loading`,`
 position: absolute;
 top: 50%;
 left: 50%;
 transform: translateX(-50%) translateY(-50%);
 font-size: calc(var(--n-button-width) - 4px);
 color: var(--n-loading-color);
 transition: color .3s var(--n-bezier);
 `,[b({left:`50%`,top:`50%`,originalTransform:`translateX(-50%) translateY(-50%)`})]),e(`checked, unchecked`,`
 transition: color .3s var(--n-bezier);
 color: var(--n-text-color);
 box-sizing: border-box;
 position: absolute;
 white-space: nowrap;
 top: 0;
 bottom: 0;
 display: flex;
 align-items: center;
 line-height: 1;
 `),e(`checked`,`
 right: 0;
 padding-right: calc(1.25 * var(--n-rail-height) - var(--n-offset));
 `),e(`unchecked`,`
 left: 0;
 justify-content: flex-end;
 padding-left: calc(1.25 * var(--n-rail-height) - var(--n-offset));
 `),u(`&:focus`,[e(`rail`,`
 box-shadow: var(--n-box-shadow-focus);
 `)]),m(`round`,[e(`rail`,`border-radius: calc(var(--n-rail-height) / 2);`,[e(`button`,`border-radius: calc(var(--n-button-height) / 2);`)])]),T(`disabled`,[T(`icon`,[m(`rubber-band`,[m(`pressed`,[e(`rail`,[e(`button`,`max-width: var(--n-button-width-pressed);`)])]),e(`rail`,[u(`&:active`,[e(`button`,`max-width: var(--n-button-width-pressed);`)])]),m(`active`,[m(`pressed`,[e(`rail`,[e(`button`,`left: calc(100% - var(--n-offset) - var(--n-button-width-pressed));`)])]),e(`rail`,[u(`&:active`,[e(`button`,`left: calc(100% - var(--n-offset) - var(--n-button-width-pressed));`)])])])])])]),m(`active`,[e(`rail`,[e(`button`,`left: calc(100% - var(--n-button-width) - var(--n-offset))`)])]),e(`rail`,`
 overflow: hidden;
 height: var(--n-rail-height);
 min-width: var(--n-rail-width);
 border-radius: var(--n-rail-border-radius);
 cursor: pointer;
 position: relative;
 transition:
 opacity .3s var(--n-bezier),
 background .3s var(--n-bezier),
 box-shadow .3s var(--n-bezier);
 background-color: var(--n-rail-color);
 `,[e(`button-icon`,`
 color: var(--n-icon-color);
 transition: color .3s var(--n-bezier);
 font-size: calc(var(--n-button-height) - 4px);
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 bottom: 0;
 display: flex;
 justify-content: center;
 align-items: center;
 line-height: 1;
 `,[b()]),e(`button`,`
 align-items: center; 
 top: var(--n-offset);
 left: var(--n-offset);
 height: var(--n-button-height);
 width: var(--n-button-width-pressed);
 max-width: var(--n-button-width);
 border-radius: var(--n-button-border-radius);
 background-color: var(--n-button-color);
 box-shadow: var(--n-button-box-shadow);
 box-sizing: border-box;
 cursor: inherit;
 content: "";
 position: absolute;
 transition:
 background-color .3s var(--n-bezier),
 left .3s var(--n-bezier),
 opacity .3s var(--n-bezier),
 max-width .3s var(--n-bezier),
 box-shadow .3s var(--n-bezier);
 `)]),m(`active`,[e(`rail`,`background-color: var(--n-rail-color-active);`)]),m(`loading`,[e(`rail`,`
 cursor: wait;
 `)]),m(`disabled`,[e(`rail`,`
 cursor: not-allowed;
 opacity: .5;
 `)])]),L=[`aria-checked`,`tabindex`,`onClick`,`onFocus`,`onBlur`,`onKeyup`,`onKeydown`],R={...o.props,size:String,value:{type:[String,Number,Boolean],default:void 0},loading:Boolean,defaultValue:{type:[String,Number,Boolean],default:!1},disabled:{type:Boolean,default:void 0},round:{type:Boolean,default:!0},"onUpdate:value":[Function,Array],onUpdateValue:[Function,Array],checkedValue:{type:[String,Number,Boolean],default:!0},uncheckedValue:{type:[String,Number,Boolean],default:!1},railStyle:Function,rubberBand:{type:Boolean,default:!0},spinProps:Object,onChange:[Function,Array]},z,B=v({name:`Switch`,props:R,slots:Object,setup(e){z===void 0&&(z=typeof CSS<`u`?CSS.supports!==void 0&&CSS.supports(`width`,`max(1px)`):!0);let{mergedClsPrefixRef:t,inlineThemeDisabled:n,mergedComponentPropsRef:r}=_(e),i=o(`Switch`,`-switch`,I,F,e,t),a=f(e,{mergedSize(t){return e.size===void 0?t?t.mergedSize.value:r?.value?.Switch?.size||`medium`:e.size}}),{mergedSizeRef:c,mergedDisabledRef:u}=a,d=C(e.defaultValue),p=S(e,`value`),m=A(p,d),h=O(()=>m.value===e.checkedValue),g=C(!1),v=C(!1),y=O(()=>{let{railStyle:t}=e;if(t)return t({focused:v.value,checked:h.value})});function b(t){let{"onUpdate:value":n,onChange:r,onUpdateValue:i}=e,{nTriggerFormInput:o,nTriggerFormChange:c}=a;n&&s(n,t),i&&s(i,t),r&&s(r,t),d.value=t,o(),c()}function w(){let{nTriggerFormFocus:e}=a;e()}function T(){let{nTriggerFormBlur:e}=a;e()}function E(){e.loading||u.value||(m.value===e.checkedValue?b(e.uncheckedValue):b(e.checkedValue))}function D(){v.value=!0,w()}function k(){v.value=!1,T(),g.value=!1}function N(t){e.loading||u.value||t.key===` `&&(m.value===e.checkedValue?b(e.uncheckedValue):b(e.checkedValue),g.value=!1)}function P(t){e.loading||u.value||t.key===` `&&(t.preventDefault(),g.value=!0)}let L=O(()=>{let{value:e}=c,{self:{opacityDisabled:t,railColor:n,railColorActive:r,buttonBoxShadow:a,buttonColor:o,boxShadowFocus:s,loadingColor:l,textColor:u,iconColor:d,[x(`buttonHeight`,e)]:f,[x(`buttonWidth`,e)]:p,[x(`buttonWidthPressed`,e)]:m,[x(`railHeight`,e)]:h,[x(`railWidth`,e)]:g,[x(`railBorderRadius`,e)]:_,[x(`buttonBorderRadius`,e)]:v},common:{cubicBezierEaseInOut:y}}=i.value,b,S,C;return z?(b=`calc((${h} - ${f}) / 2)`,S=`max(${h}, ${f})`,C=`max(${g}, calc(${g} + ${f} - ${h}))`):(b=M((j(h)-j(f))/2),S=M(Math.max(j(h),j(f))),C=j(h)>j(f)?g:M(j(g)+j(f)-j(h))),{"--n-bezier":y,"--n-button-border-radius":v,"--n-button-box-shadow":a,"--n-button-color":o,"--n-button-width":p,"--n-button-width-pressed":m,"--n-button-height":f,"--n-height":S,"--n-offset":b,"--n-opacity-disabled":t,"--n-rail-border-radius":_,"--n-rail-color":n,"--n-rail-color-active":r,"--n-rail-height":h,"--n-rail-width":g,"--n-width":C,"--n-box-shadow-focus":s,"--n-loading-color":l,"--n-text-color":u,"--n-icon-color":d}}),R=n?l(`switch`,O(()=>c.value[0]),L,e):void 0;return{handleClick:E,handleBlur:k,handleFocus:D,handleKeyup:N,handleKeydown:P,mergedRailStyle:y,pressed:g,mergedClsPrefix:t,mergedValue:m,checked:h,mergedDisabled:u,cssVars:n?void 0:L,themeClass:R?.themeClass,onRender:R?.onRender}},render(){let{mergedClsPrefix:e,mergedDisabled:n,checked:o,mergedRailStyle:s,onRender:l,$slots:u}=this;l?.();let{checked:d,unchecked:f,icon:m,"checked-icon":_,"unchecked-icon":v}=u,b=!(i(m)&&i(_)&&i(v));return a(),r(`div`,{role:`switch`,"aria-checked":o,class:w([`${e}-switch`,this.themeClass,b&&`${e}-switch--icon`,o&&`${e}-switch--active`,n&&`${e}-switch--disabled`,this.round&&`${e}-switch--round`,this.loading&&`${e}-switch--loading`,this.pressed&&`${e}-switch--pressed`,this.rubberBand&&`${e}-switch--rubber-band`]),tabindex:this.mergedDisabled?void 0:0,style:y(this.cssVars),onClick:this.handleClick,onFocus:this.handleFocus,onBlur:this.handleBlur,onKeyup:this.handleKeyup,onKeydown:this.handleKeydown},[p(`div`,{class:w(`${e}-switch__rail`),"aria-hidden":`true`,style:y(s)},[E(()=>t(d,n=>t(f,t=>n||t?(a(),r(`div`,{key:4,"aria-hidden":!0,class:w(`${e}-switch__children-placeholder`)},[p(`div`,{class:w(`${e}-switch__rail-placeholder`)},[p(`div`,{class:w(`${e}-switch__button-placeholder`)},null,2),E(()=>n)],2),p(`div`,{class:w(`${e}-switch__rail-placeholder`)},[p(`div`,{class:w(`${e}-switch__button-placeholder`)},null,2),E(()=>t)],2)],2)):null))),p(`div`,{class:w(`${e}-switch__button`)},[E(()=>t(m,n=>t(_,i=>t(v,t=>(a(),D(g,null,{default:()=>this.loading?(a(),D(h,c({key:`loading`,clsPrefix:e,strokeWidth:20},this.spinProps),null,16,[`clsPrefix`])):this.checked&&(i||n)?(a(),r(`div`,{class:w(`${e}-switch__button-icon`),key:i?`checked-icon`:`icon`},[E(()=>i||n)],2)):!this.checked&&(t||n)?(a(),r(`div`,{class:w(`${e}-switch__button-icon`),key:t?`unchecked-icon`:`icon`},[E(()=>t||n)],2)):null},1024)))))),E(()=>t(d,t=>t&&(a(),r(`div`,{key:`checked`,class:w(`${e}-switch__checked`)},[E(()=>t)],2)))),E(()=>t(f,t=>t&&(a(),r(`div`,{key:`unchecked`,class:w(`${e}-switch__unchecked`)},[E(()=>t)],2))))],2)],6)],46,L)}});export{B as t};