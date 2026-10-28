import{$t as e,A as t,Bn as n,Cn as r,Dn as i,F as a,Fn as o,Gn as s,Hn as c,In as l,L as u,M as d,Mn as f,N as p,O as m,P as h,Pn as g,Qn as _,R as v,Rn as y,Sn as b,T as x,Un as S,Xn as C,Xt as w,Yn as T,Zt as E,_ as ee,bn as D,ct as O,dn as k,en as A,f as te,ft as j,hn as M,ht as ne,jn as N,kn as P,lr as F,nn as I,or as L,ot as R,rr as z,sn as B,st as V,tn as H,ur as U,ut as W,xn as G,yn as K,zn as q}from"./light-C36WBRZZ.js";import{c as J,r as re,s as ie,t as ae}from"./_plugin-vue_export-helper-Y2v3pMRv.js";import{$ as Y,Bt as X,G as oe,Ht as se,K as ce,Nt as Z,Q as le,R as ue,Rt as Q,Vt as $,Z as de,_t as fe,lt as pe,ot as me,pt as he,ut as ge}from"./discrete-BMBIarA6.js";import{C as _e,S as ve,_ as ye,b as be,c as xe,d as Se,f as Ce,g as we,h as Te,i as Ee,m as De,n as Oe,p as ke,r as Ae,v as je,w as Me,x as Ne}from"./Tooltip-CjyHKpY1.js";function Pe(e){return e&-e}var Fe=class{constructor(e,t){this.l=e,this.min=t;let n=Array(e+1);for(let t=0;t<e+1;++t)n[t]=0;this.ft=n}add(e,t){if(t===0)return;let{l:n,ft:r}=this;for(e+=1;e<=n;)r[e]+=t,e+=Pe(e)}get(e){return this.sum(e+1)-this.sum(e)}sum(e){if(e===void 0&&(e=this.l),e<=0)return 0;let{ft:t,min:n,l:r}=this;if(e>r)throw Error("[FinweckTree.sum]: `i` is larger than length.");let i=e*n;for(;e>0;)i+=t[e],e-=Pe(e);return i}getBound(e){let t=0,n=this.l;for(;n>t;){let r=Math.floor((t+n)/2),i=this.sum(r);if(i>e)n=r;else if(i<e){if(t===r)return this.sum(t+1)<=e?t+1:r;t=r}else return r}return t}},Ie;function Le(){return typeof document>`u`?!1:(Ie===void 0&&(Ie=`matchMedia`in window&&window.matchMedia(`(pointer:coarse)`).matches),Ie)}var Re;function ze(){return typeof document>`u`?1:(Re===void 0&&(Re=`chrome`in window?window.devicePixelRatio:1),Re)}var Be=`VVirtualListXScroll`;function Ve({columnsRef:e,renderColRef:t,renderItemWithColsRef:n}){let r=z(0),i=z(0),a=K(()=>{let t=e.value;if(t.length===0)return null;let n=new Fe(t.length,0);return t.forEach((e,t)=>{n.add(t,e.width)}),n}),o=h(()=>{let e=a.value;return e===null?0:Math.max(e.getBound(i.value)-1,0)}),s=e=>{let t=a.value;return t===null?0:t.sum(e)},c=h(()=>{let t=a.value;return t===null?0:Math.min(t.getBound(i.value+r.value)+1,e.value.length-1)});return S(Be,{startIndexRef:o,endIndexRef:c,columnsRef:e,renderColRef:t,renderItemWithColsRef:n,getLeft:s}),{listWidthRef:r,scrollLeftRef:i}}var He=P({name:`VirtualListRow`,props:{index:{type:Number,required:!0},item:{type:Object,required:!0}},setup(){let{startIndexRef:e,endIndexRef:t,columnsRef:n,getLeft:r,renderColRef:i,renderItemWithColsRef:a}=f(Be);return{startIndex:e,endIndex:t,columns:n,renderCol:i,renderItemWithCols:a,getLeft:r}},render(){let{startIndex:e,endIndex:t,columns:n,renderCol:r,renderItemWithCols:i,getLeft:a,item:o}=this;if(i!=null)return i({itemIndex:this.index,startColIndex:e,endColIndex:t,allColumns:n,item:o,getLeft:a});if(r!=null){let i=[];for(let s=e;s<=t;++s){let e=n[s];i.push(r({column:e,left:a(s),item:o}))}return i}return null}}),Ue=ke(`.v-vl`,{maxHeight:`inherit`,height:`100%`,overflow:`auto`,minWidth:`1px`},[ke(`&:not(.v-vl--show-scrollbar)`,{scrollbarWidth:`none`},[ke(`&::-webkit-scrollbar, &::-webkit-scrollbar-track-piece, &::-webkit-scrollbar-thumb`,{width:0,height:0,display:`none`})])]),We=P({name:`VirtualList`,inheritAttrs:!1,props:{showScrollbar:{type:Boolean,default:!0},columns:{type:Array,default:()=>[]},renderCol:Function,renderItemWithCols:Function,items:{type:Array,default:()=>[]},itemSize:{type:Number,required:!0},itemResizable:Boolean,itemsStyle:[String,Object],visibleItemsTag:{type:[String,Object],default:`div`},visibleItemsProps:Object,ignoreItemResize:Boolean,onScroll:Function,onWheel:Function,onResize:Function,defaultScrollKey:[Number,String],defaultScrollIndex:Number,keyField:{type:String,default:`key`},paddingTop:{type:[Number,String],default:0},paddingBottom:{type:[Number,String],default:0}},setup(e){let t=j();Ue.mount({id:`vueuc/virtual-list`,head:!0,anchorMetaName:De,ssr:t}),n(()=>{let{defaultScrollIndex:t,defaultScrollKey:n}=e;t==null?n!=null&&y({key:n}):y({index:t})});let r=!1,i=!1;l(()=>{r=!1,i?y({top:g.value,left:s.value}):i=!0}),q(()=>{r=!0,i||=!0});let a=h(()=>{if(e.renderCol==null&&e.renderItemWithCols==null||e.columns.length===0)return;let t=0;return e.columns.forEach(e=>{t+=e.width}),t}),o=K(()=>{let t=new Map,{keyField:n}=e;return e.items.forEach((e,r)=>{t.set(e[n],r)}),t}),{scrollLeftRef:s,listWidthRef:c}=Ve({columnsRef:L(e,`columns`),renderColRef:L(e,`renderCol`),renderItemWithColsRef:L(e,`renderItemWithCols`)}),u=z(null),d=z(void 0),f=new Map,p=K(()=>{let{items:t,itemSize:n,keyField:r}=e,i=new Fe(t.length,n);return t.forEach((e,t)=>{let n=e[r],a=f.get(n);a!==void 0&&i.add(t,a)}),i}),m=z(0),g=z(0),_=h(()=>Math.max(p.value.getBound(g.value-Q(e.paddingTop))-1,0)),v=K(()=>{let{value:t}=d;if(t===void 0)return[];let{items:n,itemSize:r}=e,i=_.value,a=Math.min(i+Math.ceil(t/r+1),n.length-1),o=[];for(let e=i;e<=a;++e)o.push(n[e]);return o}),y=(e,t)=>{if(typeof e==`number`){C(e,t,`auto`);return}let{left:n,top:r,index:i,key:a,position:s,behavior:c,debounce:l=!0}=e;if(n!==void 0||r!==void 0)C(n,r,c);else if(i!==void 0)S(i,c,l);else if(a!==void 0){let e=o.value.get(a);e!==void 0&&S(e,c,l)}else s===`bottom`?C(0,2**53-1,c):s===`top`&&C(0,0,c)},b,x=null;function S(t,n,r){let i=u.value;if(i==null)return;let{value:a}=p,o=a.sum(t)+Q(e.paddingTop);if(!r)i.scrollTo({left:0,top:o,behavior:n});else{b=t,x!==null&&window.clearTimeout(x),x=window.setTimeout(()=>{b=void 0,x=null},16);let{scrollTop:e,offsetHeight:r}=i;if(o>e){let s=a.get(t);o+s<=e+r||i.scrollTo({left:0,top:o+s-r,behavior:n})}else i.scrollTo({left:0,top:o,behavior:n})}}function C(e,t,n){u.value?.scrollTo({left:e,top:t,behavior:n})}function w(t,n){if(r||e.ignoreItemResize||A(n.target))return;let{value:i}=p,a=o.value.get(t),s=i.get(a),c=n.borderBoxSize?.[0]?.blockSize??n.contentRect.height;if(c===s)return;c-e.itemSize===0?f.delete(t):f.set(t,c-e.itemSize);let l=c-s;if(l===0)return;i.add(a,l);let d=u.value;if(d!=null){if(b===void 0){let e=i.sum(a);d.scrollTop>e&&d.scrollBy(0,l)}else(a<b||a===b&&c+i.sum(a)>d.scrollTop+d.offsetHeight)&&d.scrollBy(0,l);k()}m.value++}let T=!Le(),E=!1;function ee(t){var n;(n=e.onScroll)==null||n.call(e,t),T&&E||k()}function D(t){var n;if((n=e.onWheel)==null||n.call(e,t),T){let e=u.value;if(e!=null){if(t.deltaX===0&&(e.scrollTop===0&&t.deltaY<=0||e.scrollTop+e.offsetHeight>=e.scrollHeight&&t.deltaY>=0))return;t.preventDefault(),e.scrollTop+=t.deltaY/ze(),e.scrollLeft+=t.deltaX/ze(),k(),E=!0,Me(()=>{E=!1})}}}function O(t){if(r||A(t.target))return;if(e.renderCol==null&&e.renderItemWithCols==null){if(t.contentRect.height===d.value)return}else if(t.contentRect.height===d.value&&t.contentRect.width===c.value)return;d.value=t.contentRect.height,c.value=t.contentRect.width;let{onResize:n}=e;n!==void 0&&n(t)}function k(){let{value:e}=u;e!=null&&(g.value=e.scrollTop,s.value=e.scrollLeft)}function A(e){let t=e;for(;t!==null;){if(t.style.display===`none`)return!0;t=t.parentElement}return!1}return{listHeight:d,listStyle:{overflow:`auto`},keyToIndex:o,itemsStyle:K(()=>{let{itemResizable:t}=e,n=$(p.value.sum());return m.value,[e.itemsStyle,{boxSizing:`content-box`,width:$(a.value),height:t?``:n,minHeight:t?n:``,paddingTop:$(e.paddingTop),paddingBottom:$(e.paddingBottom)}]}),visibleItemsStyle:K(()=>(m.value,{transform:`translateY(${$(p.value.sum(_.value))})`})),viewportItems:v,listElRef:u,itemsElRef:z(null),scrollTo:y,handleListResize:O,handleListScroll:ee,handleListWheel:D,handleItemResize:w}},render(){let{itemResizable:e,keyField:t,keyToIndex:n,visibleItemsTag:r}=this;return N(pe,{onResize:this.handleListResize},{default:()=>{var i;return N(`div`,g(this.$attrs,{class:[`v-vl`,this.showScrollbar&&`v-vl--show-scrollbar`],onScroll:this.handleListScroll,onWheel:this.handleListWheel,ref:`listElRef`}),[this.items.length===0?(i=this.$slots).empty?.call(i):N(`div`,{ref:`itemsElRef`,class:`v-vl-items`,style:this.itemsStyle},[N(r,Object.assign({class:`v-vl-visible-items`,style:this.visibleItemsStyle},this.visibleItemsProps),{default:()=>{let{renderCol:r,renderItemWithCols:i}=this;return this.viewportItems.map(a=>{let o=a[t],s=n.get(o),c=r==null?void 0:N(He,{index:s,item:a}),l=i==null?void 0:N(He,{index:s,item:a}),u=this.$slots.default({item:a,renderedCols:c,renderedItemWithCols:l,index:s})[0];return e?N(pe,{key:o,onResize:e=>this.handleItemResize(o,e)},{default:()=>u}):(u.key=o,u)})}})])])}})}});function Ge(e){switch(typeof e){case`string`:return e||void 0;case`number`:return String(e);default:return}}function Ke(e,t){t&&(n(()=>{let{value:n}=e;n&&ge.registerHandler(n,t)}),T(e,(e,t)=>{t&&ge.unregisterHandler(t)},{deep:!1}),y(()=>{let{value:t}=e;t&&ge.unregisterHandler(t)}))}var qe=P({props:{onFocus:Function,onBlur:Function},setup(e){return()=>(()=>{let t=R(`d16ead82505dc285`);return c(),r(`div`,{style:`width: 0; height: 0`,tabindex:0,onFocus:t[0]||=t=>e.onFocus?.(t),onBlur:t[1]||=t=>e.onBlur?.(t)},null,32)})()}}),Je=P({name:`NBaseSelectGroupHeader`,props:{clsPrefix:{type:String,required:!0},tmNode:{type:Object,required:!0}},setup(){let{renderLabelRef:e,renderOptionRef:t,labelFieldRef:n,nodePropsRef:r}=f(Ne);return{labelField:n,nodeProps:r,renderLabel:e,renderOption:t}},render(){let{clsPrefix:e,renderLabel:t,renderOption:n,nodeProps:i,tmNode:{rawNode:a}}=this,o=i?.(a),s=t?t(a,!1):Y(a[this.labelField],a,!1),l=(c(),r(`div`,g(o,{class:[`${e}-base-select-group-header`,o?.class]}),[W(()=>s)],16));return a.render?a.render({node:l,option:a}):n?n({node:l,option:a,selected:!1}):l}}),Ye=P({name:`Checkmark`,render(){return(()=>{let e=R(`3c84eac8ae4e1f96`);return e[0]||=D(`svg`,{xmlns:`http://www.w3.org/2000/svg`,viewBox:`0 0 16 16`},[D(`g`,{fill:`none`},[D(`path`,{d:`M14.046 3.486a.75.75 0 0 1-.032 1.06l-7.93 7.474a.85.85 0 0 1-1.188-.022l-2.68-2.72a.75.75 0 1 1 1.068-1.053l2.234 2.267l7.468-7.038a.75.75 0 0 1 1.06.032z`,fill:`currentColor`})])],-1)})()}}),Xe=[`onClick`,`onMouseenter`,`onMousemove`];function Ze(e,t){return c(),G(B,{name:`fade-in-scale-up-transition`},{default:()=>e?(c(),G(a,{key:1,clsPrefix:t,class:V(`${t}-base-select-option__check`)},{default:()=>N(Ye)},1032,[`clsPrefix`,`class`])):null},1024)}var Qe=P({name:`NBaseSelectOption`,props:{clsPrefix:{type:String,required:!0},tmNode:{type:Object,required:!0}},setup(e){let{valueRef:t,pendingTmNodeRef:n,multipleRef:r,valueSetRef:i,renderLabelRef:a,renderOptionRef:o,labelFieldRef:s,valueFieldRef:c,showCheckmarkRef:l,nodePropsRef:u,handleOptionClick:d,handleOptionMouseEnter:p}=f(Ne),m=h(()=>{let{value:t}=n;return t?e.tmNode.key===t.key:!1});function g(t){let{tmNode:n}=e;n.disabled||d(t,n)}function _(t){let{tmNode:n}=e;n.disabled||p(t,n)}function v(t){let{tmNode:n}=e,{value:r}=m;n.disabled||r||p(t,n)}return{multiple:r,isGrouped:h(()=>{let{tmNode:t}=e,{parent:n}=t;return n&&n.rawNode.type===`group`}),showCheckmark:l,nodeProps:u,isPending:m,isSelected:h(()=>{let{value:n}=t,{value:a}=r;if(n===null)return!1;let o=e.tmNode.rawNode[c.value];if(a){let{value:e}=i;return e.has(o)}return n===o}),labelField:s,renderLabel:a,renderOption:o,handleMouseMove:v,handleMouseEnter:_,handleClick:g}},render(){let{clsPrefix:e,tmNode:{rawNode:t},isSelected:n,isPending:i,isGrouped:a,showCheckmark:o,nodeProps:s,renderOption:l,renderLabel:u,handleClick:d,handleMouseEnter:f,handleMouseMove:p}=this,m=Ze(n,e),h=u?[u(t,n),o&&m]:[Y(t[this.labelField],t,n),o&&m],_=s?.(t),v=(c(),r(`div`,g(_,{class:[`${e}-base-select-option`,t.class,_?.class,{[`${e}-base-select-option--disabled`]:t.disabled,[`${e}-base-select-option--selected`]:n,[`${e}-base-select-option--grouped`]:a,[`${e}-base-select-option--pending`]:i,[`${e}-base-select-option--show-checkmark`]:o}],style:[_?.style||``,t.style||``],onClick:le([d,_?.onClick]),onMouseenter:le([f,_?.onMouseenter]),onMousemove:le([p,_?.onMousemove])}),[D(`div`,{class:V(`${e}-base-select-option__content`)},[W(()=>h)],2)],16,Xe));return t.render?t.render({node:v,option:t,selected:n}):l?l({node:v,option:t,selected:n}):v}}),$e=E(`base-select-menu`,`
 line-height: 1.5;
 outline: none;
 z-index: 0;
 position: relative;
 border-radius: var(--n-border-radius);
 transition:
 background-color .3s var(--n-bezier),
 box-shadow .3s var(--n-bezier);
 background-color: var(--n-color);
`,[E(`scrollbar`,`
 max-height: var(--n-height);
 `),E(`virtual-list`,`
 max-height: var(--n-height);
 `),E(`base-select-option`,`
 min-height: var(--n-option-height);
 font-size: var(--n-option-font-size);
 display: flex;
 align-items: center;
 `,[e(`content`,`
 z-index: 1;
 white-space: nowrap;
 text-overflow: ellipsis;
 overflow: hidden;
 `)]),E(`base-select-group-header`,`
 min-height: var(--n-option-height);
 font-size: .93em;
 display: flex;
 align-items: center;
 `),E(`base-select-menu-option-wrapper`,`
 position: relative;
 width: 100%;
 `),e(`loading, empty`,`
 display: flex;
 padding: 12px 32px;
 flex: 1;
 justify-content: center;
 `),e(`loading`,`
 color: var(--n-loading-color);
 font-size: var(--n-loading-size);
 `),e(`header`,`
 padding: 8px var(--n-option-padding-left);
 font-size: var(--n-option-font-size);
 transition: 
 color .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
 border-bottom: 1px solid var(--n-action-divider-color);
 color: var(--n-action-text-color);
 `),e(`action`,`
 padding: 8px var(--n-option-padding-left);
 font-size: var(--n-option-font-size);
 transition: 
 color .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
 border-top: 1px solid var(--n-action-divider-color);
 color: var(--n-action-text-color);
 `),E(`base-select-group-header`,`
 position: relative;
 cursor: default;
 padding: var(--n-option-padding);
 color: var(--n-group-header-text-color);
 `),E(`base-select-option`,`
 cursor: pointer;
 position: relative;
 padding: var(--n-option-padding);
 transition:
 color .3s var(--n-bezier),
 opacity .3s var(--n-bezier);
 box-sizing: border-box;
 color: var(--n-option-text-color);
 opacity: 1;
 `,[A(`show-checkmark`,`
 padding-right: calc(var(--n-option-padding-right) + 20px);
 `),w(`&::before`,`
 content: "";
 position: absolute;
 left: 4px;
 right: 4px;
 top: 0;
 bottom: 0;
 border-radius: var(--n-border-radius);
 transition: background-color .3s var(--n-bezier);
 `),w(`&:active`,`
 color: var(--n-option-text-color-pressed);
 `),A(`grouped`,`
 padding-left: calc(var(--n-option-padding-left) * 1.5);
 `),A(`pending`,[w(`&::before`,`
 background-color: var(--n-option-color-pending);
 `)]),A(`selected`,`
 color: var(--n-option-text-color-active);
 `,[w(`&::before`,`
 background-color: var(--n-option-color-active);
 `),A(`pending`,[w(`&::before`,`
 background-color: var(--n-option-color-active-pending);
 `)])]),A(`disabled`,`
 cursor: not-allowed;
 `,[H(`selected`,`
 color: var(--n-option-text-color-disabled);
 `),A(`selected`,`
 opacity: var(--n-option-opacity-disabled);
 `)]),e(`check`,`
 font-size: 16px;
 position: absolute;
 right: calc(var(--n-option-padding-right) - 4px);
 top: calc(50% - 7px);
 color: var(--n-option-check-color);
 transition: color .3s var(--n-bezier);
 `,[de({enterScale:`0.5`})])])]),et=[`tabindex`,`onFocusin`,`onFocusout`,`onKeyup`,`onKeydown`,`onMousedown`,`onMouseenter`,`onMouseleave`],tt=P({name:`InternalSelectMenu`,props:{...u.props,clsPrefix:{type:String,required:!0},scrollable:{type:Boolean,default:!0},treeMate:{type:Object,required:!0},multiple:Boolean,size:{type:String,default:`medium`},value:{type:[String,Number,Array],default:null},autoPending:Boolean,virtualScroll:{type:Boolean,default:!0},show:{type:Boolean,default:!0},labelField:{type:String,default:`label`},valueField:{type:String,default:`value`},loading:Boolean,focusable:Boolean,renderLabel:Function,renderOption:Function,nodeProps:Function,showCheckmark:{type:Boolean,default:!0},onMousedown:Function,onScroll:Function,onFocus:Function,onBlur:Function,onKeyup:Function,onKeydown:Function,onTabOut:Function,onMouseenter:Function,onMouseleave:Function,onResize:Function,resetMenuOnOptionsChange:{type:Boolean,default:!0},inlineThemeDisabled:Boolean,scrollbarProps:Object,onToggle:Function},setup(e){let{mergedClsPrefixRef:t,mergedRtlRef:r,mergedComponentPropsRef:i}=ne(e),a=x(`InternalSelectMenu`,r,t),s=u(`InternalSelectMenu`,`-internal-select-menu`,$e,Z,e,L(e,`clsPrefix`)),c=z(null),l=z(null),d=z(null),f=K(()=>e.treeMate.getFlattenedNodes()),p=K(()=>Ae(f.value)),m=z(null);function h(){let{treeMate:t}=e,n=null,{value:r}=e;r===null?n=t.getFirstAvailableNode():(n=e.multiple?t.getNode((r||[])[(r||[]).length-1]):t.getNode(r),(!n||n.disabled)&&(n=t.getFirstAvailableNode())),V(n||null)}function g(){let{value:t}=m;t&&!e.treeMate.getNode(t.key)&&(m.value=null)}let _;T(()=>e.show,t=>{t?_=T(()=>e.treeMate,()=>{e.resetMenuOnOptionsChange?(e.autoPending?h():g(),o(H)):g()},{immediate:!0}):_?.()},{immediate:!0}),y(()=>{_?.()});let b=K(()=>Q(s.value.self[I(`optionHeight`,e.size)])),C=K(()=>X(s.value.self[I(`padding`,e.size)])),w=K(()=>e.multiple&&Array.isArray(e.value)?new Set(e.value):new Set),E=K(()=>{let e=f.value;return e&&e.length===0}),ee=K(()=>i?.value?.Select?.renderEmpty);function D(t){let{onToggle:n}=e;n&&n(t)}function O(t){let{onScroll:n}=e;n&&n(t)}function k(e){d.value?.sync(),O(e)}function A(){d.value?.sync()}function te(){let{value:e}=m;return e||null}function j(e,t){t.disabled||V(t,!1)}function M(e,t){t.disabled||D(t)}function N(t){_e(t,`action`)||e.onKeyup?.(t)}function P(t){_e(t,`action`)||e.onKeydown?.(t)}function F(t){e.onMousedown?.(t),!e.focusable&&t.preventDefault()}function R(){let{value:e}=m;e&&V(e.getNext({loop:!0}),!0)}function B(){let{value:e}=m;e&&V(e.getPrev({loop:!0}),!0)}function V(e,t=!1){m.value=e,t&&H()}function H(){let t=m.value;if(!t)return;let n=p.value(t.key);n!==null&&(e.virtualScroll?l.value?.scrollTo({index:n}):d.value?.scrollTo({index:n,elSize:b.value}))}function U(t){c.value?.contains(t.target)&&e.onFocus?.(t)}function W(t){c.value?.contains(t.relatedTarget)||e.onBlur?.(t)}S(Ne,{handleOptionMouseEnter:j,handleOptionClick:M,valueSetRef:w,pendingTmNodeRef:m,nodePropsRef:L(e,`nodeProps`),showCheckmarkRef:L(e,`showCheckmark`),multipleRef:L(e,`multiple`),valueRef:L(e,`value`),renderLabelRef:L(e,`renderLabel`),renderOptionRef:L(e,`renderOption`),labelFieldRef:L(e,`labelField`),valueFieldRef:L(e,`valueField`)}),S(be,c),n(()=>{let{value:e}=d;e&&e.sync()});let G=K(()=>{let{size:t}=e,{common:{cubicBezierEaseInOut:n},self:{height:r,borderRadius:i,color:a,groupHeaderTextColor:o,actionDividerColor:c,optionTextColorPressed:l,optionTextColor:u,optionTextColorDisabled:d,optionTextColorActive:f,optionOpacityDisabled:p,optionCheckColor:m,actionTextColor:h,optionColorPending:g,optionColorActive:_,loadingColor:v,loadingSize:y,optionColorActivePending:b,[I(`optionFontSize`,t)]:x,[I(`optionHeight`,t)]:S,[I(`optionPadding`,t)]:C}}=s.value;return{"--n-height":r,"--n-action-divider-color":c,"--n-action-text-color":h,"--n-bezier":n,"--n-border-radius":i,"--n-color":a,"--n-option-font-size":x,"--n-group-header-text-color":o,"--n-option-check-color":m,"--n-option-color-pending":g,"--n-option-color-active":_,"--n-option-color-active-pending":b,"--n-option-height":S,"--n-option-opacity-disabled":p,"--n-option-text-color":u,"--n-option-text-color-active":f,"--n-option-text-color-disabled":d,"--n-option-text-color-pressed":l,"--n-option-padding":C,"--n-option-padding-left":X(C,`left`),"--n-option-padding-right":X(C,`right`),"--n-loading-color":v,"--n-loading-size":y}}),{inlineThemeDisabled:q}=e,J=q?v(`internal-select-menu`,K(()=>e.size[0]),G,e):void 0,re={selfRef:c,next:R,prev:B,getPendingTmNode:te};return Ke(c,e.onResize),{mergedTheme:s,mergedClsPrefix:t,rtlEnabled:a,virtualListRef:l,scrollbarRef:d,itemSize:b,padding:C,flattenedNodes:f,empty:E,mergedRenderEmpty:ee,virtualListContainer(){let{value:e}=l;return e?.listElRef},virtualListContent(){let{value:e}=l;return e?.itemsElRef},doScroll:O,handleFocusin:U,handleFocusout:W,handleKeyUp:N,handleKeyDown:P,handleMouseDown:F,handleVirtualListResize:A,handleVirtualListScroll:k,cssVars:q?void 0:G,themeClass:J?.themeClass,onRender:J?.onRender,...re}},render(){let{$slots:e,virtualScroll:n,clsPrefix:i,mergedTheme:a,themeClass:o,onRender:s}=this;return s?.(),c(),r(`div`,{ref:`selfRef`,tabindex:this.focusable?0:-1,class:V([`${i}-base-select-menu`,`${i}-base-select-menu--${this.size}-size`,this.rtlEnabled&&`${i}-base-select-menu--rtl`,o,this.multiple&&`${i}-base-select-menu--multiple`]),style:F(this.cssVars),onFocusin:this.handleFocusin,onFocusout:this.handleFocusout,onKeyup:this.handleKeyUp,onKeydown:this.handleKeyDown,onMousedown:this.handleMouseDown,onMouseenter:this.onMouseenter,onMouseleave:this.onMouseleave},[W(()=>t(e.header,e=>e&&(c(),r(`div`,{class:V(`${i}-base-select-menu__header`),"data-header":!0,key:`header`},[W(()=>e)],2)))),this.loading?(c(),r(`div`,{key:0,class:V(`${i}-base-select-menu__loading`)},[(c(),G(te,{clsPrefix:i,strokeWidth:20},null,8,[`clsPrefix`]))],2)):(c(),r(M,{key:1},[this.empty?(c(),r(`div`,{key:1,class:V(`${i}-base-select-menu__empty`),"data-empty":!0},[W(()=>m(e.empty,()=>[this.mergedRenderEmpty?.()||(c(),G(ve,{theme:a.peers.Empty,themeOverrides:a.peerOverrides.Empty,size:this.size},null,8,[`theme`,`themeOverrides`,`size`]))]))],2)):(c(),G(me,g({key:0,ref:`scrollbarRef`,theme:a.peers.Scrollbar,themeOverrides:a.peerOverrides.Scrollbar,scrollable:this.scrollable,container:n?this.virtualListContainer:void 0,content:n?this.virtualListContent:void 0,onScroll:n?void 0:this.doScroll},this.scrollbarProps),{default:()=>n?(c(),G(We,{key:1,ref:`virtualListRef`,class:V(`${i}-virtual-list`),items:this.flattenedNodes,itemSize:this.itemSize,showScrollbar:!1,paddingTop:this.padding.top,paddingBottom:this.padding.bottom,onResize:this.handleVirtualListResize,onScroll:this.handleVirtualListScroll,itemResizable:!0},{default:({item:e})=>e.isGroup?(c(),G(Je,{key:e.key,clsPrefix:i,tmNode:e},null,8,[`clsPrefix`,`tmNode`])):e.ignored?null:(c(),G(Qe,{clsPrefix:i,key:e.key,tmNode:e},null,8,[`clsPrefix`,`tmNode`]))},1032,[`class`,`items`,`itemSize`,`paddingTop`,`paddingBottom`,`onResize`,`onScroll`])):(c(),r(`div`,{key:4,class:V(`${i}-base-select-menu-option-wrapper`),style:F({paddingTop:this.padding.top,paddingBottom:this.padding.bottom})},[W(()=>this.flattenedNodes.map(e=>e.isGroup?(c(),G(Je,{key:e.key,clsPrefix:i,tmNode:e},null,8,[`clsPrefix`,`tmNode`])):(c(),G(Qe,{clsPrefix:i,key:e.key,tmNode:e},null,8,[`clsPrefix`,`tmNode`]))))],6))},1040,[`theme`,`themeOverrides`,`scrollable`,`container`,`content`,`onScroll`]))],64)),W(()=>t(e.action,e=>e&&[(c(),r(`div`,{class:V(`${i}-base-select-menu__action`),"data-action":!0,key:`action`},[W(()=>e)],2)),(c(),G(qe,{onFocus:this.onTabOut,key:`focus-detector`},null,8,[`onFocus`]))]))],46,et)}});function nt(e){return e.type===`group`}function rt(e){return e.type===`ignored`}function it(e,t){try{return!!(1+t.toString().toLowerCase().indexOf(e.trim().toLowerCase()))}catch{return!1}}function at(e,t){return{getIsGroup:nt,getIgnored:rt,getKey(t){return nt(t)?t.name||t.key||`key-required`:t[e]},getChildren(e){return e[t]}}}function ot(e,t,n,r){if(!t)return e;function i(e){if(!Array.isArray(e))return[];let a=[];for(let o of e)if(nt(o)){let e=i(o[r]);e.length&&a.push(Object.assign({},o,{[r]:e}))}else if(rt(o))continue;else t(n,o)&&a.push(o);return a}return i(e)}function st(e,t,n){let r=new Map;return e.forEach(e=>{nt(e)?e[n].forEach(e=>{r.set(e[t],e)}):r.set(e[t],e)}),r}var ct=w([E(`base-selection`,`
 --n-padding-single: var(--n-padding-single-top) var(--n-padding-single-right) var(--n-padding-single-bottom) var(--n-padding-single-left);
 --n-padding-multiple: var(--n-padding-multiple-top) var(--n-padding-multiple-right) var(--n-padding-multiple-bottom) var(--n-padding-multiple-left);
 position: relative;
 z-index: auto;
 box-shadow: none;
 width: 100%;
 max-width: 100%;
 display: inline-block;
 vertical-align: bottom;
 border-radius: var(--n-border-radius);
 min-height: var(--n-height);
 line-height: 1.5;
 font-size: var(--n-font-size);
 `,[E(`base-loading`,`
 color: var(--n-loading-color);
 `),E(`base-selection-tags`,`min-height: var(--n-height);`),e(`border, state-border`,`
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 bottom: 0;
 pointer-events: none;
 border: var(--n-border);
 border-radius: inherit;
 transition:
 box-shadow .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
 `),e(`state-border`,`
 z-index: 1;
 border-color: #0000;
 `),E(`base-suffix`,`
 cursor: pointer;
 position: absolute;
 top: 50%;
 transform: translateY(-50%);
 right: 10px;
 `,[e(`arrow`,`
 font-size: var(--n-arrow-size);
 color: var(--n-arrow-color);
 transition: color .3s var(--n-bezier);
 `)]),E(`base-selection-overlay`,`
 display: flex;
 align-items: center;
 white-space: nowrap;
 pointer-events: none;
 position: absolute;
 top: 0;
 right: 0;
 bottom: 0;
 left: 0;
 padding: var(--n-padding-single);
 transition: color .3s var(--n-bezier);
 `,[e(`wrapper`,`
 flex-basis: 0;
 flex-grow: 1;
 overflow: hidden;
 text-overflow: ellipsis;
 `)]),E(`base-selection-placeholder`,`
 color: var(--n-placeholder-color);
 `,[e(`inner`,`
 max-width: 100%;
 overflow: hidden;
 `)]),E(`base-selection-tags`,`
 cursor: pointer;
 outline: none;
 box-sizing: border-box;
 position: relative;
 z-index: auto;
 display: flex;
 padding: var(--n-padding-multiple);
 flex-wrap: wrap;
 align-items: center;
 width: 100%;
 vertical-align: bottom;
 background-color: var(--n-color);
 border-radius: inherit;
 transition:
 color .3s var(--n-bezier),
 box-shadow .3s var(--n-bezier),
 background-color .3s var(--n-bezier);
 `),E(`base-selection-label`,`
 height: var(--n-height);
 display: inline-flex;
 width: 100%;
 vertical-align: bottom;
 cursor: pointer;
 outline: none;
 z-index: auto;
 box-sizing: border-box;
 position: relative;
 transition:
 color .3s var(--n-bezier),
 box-shadow .3s var(--n-bezier),
 background-color .3s var(--n-bezier);
 border-radius: inherit;
 background-color: var(--n-color);
 align-items: center;
 `,[E(`base-selection-input`,`
 font-size: inherit;
 line-height: inherit;
 outline: none;
 cursor: pointer;
 box-sizing: border-box;
 border:none;
 width: 100%;
 padding: var(--n-padding-single);
 background-color: #0000;
 color: var(--n-text-color);
 transition: color .3s var(--n-bezier);
 caret-color: var(--n-caret-color);
 `,[e(`content`,`
 text-overflow: ellipsis;
 overflow: hidden;
 white-space: nowrap; 
 `)]),e(`render-label`,`
 color: var(--n-text-color);
 `)]),H(`disabled`,[w(`&:hover`,[e(`state-border`,`
 box-shadow: var(--n-box-shadow-hover);
 border: var(--n-border-hover);
 `)]),A(`focus`,[e(`state-border`,`
 box-shadow: var(--n-box-shadow-focus);
 border: var(--n-border-focus);
 `)]),A(`active`,[e(`state-border`,`
 box-shadow: var(--n-box-shadow-active);
 border: var(--n-border-active);
 `),E(`base-selection-label`,`background-color: var(--n-color-active);`),E(`base-selection-tags`,`background-color: var(--n-color-active);`)])]),A(`disabled`,`cursor: not-allowed;`,[e(`arrow`,`
 color: var(--n-arrow-color-disabled);
 `),E(`base-selection-label`,`
 cursor: not-allowed;
 background-color: var(--n-color-disabled);
 `,[E(`base-selection-input`,`
 cursor: not-allowed;
 color: var(--n-text-color-disabled);
 `),e(`render-label`,`
 color: var(--n-text-color-disabled);
 `)]),E(`base-selection-tags`,`
 cursor: not-allowed;
 background-color: var(--n-color-disabled);
 `),E(`base-selection-placeholder`,`
 cursor: not-allowed;
 color: var(--n-placeholder-color-disabled);
 `)]),E(`base-selection-input-tag`,`
 height: calc(var(--n-height) - 6px);
 line-height: calc(var(--n-height) - 6px);
 outline: none;
 display: none;
 position: relative;
 margin-bottom: 3px;
 max-width: 100%;
 vertical-align: bottom;
 `,[e(`input`,`
 font-size: inherit;
 font-family: inherit;
 min-width: 1px;
 padding: 0;
 background-color: #0000;
 outline: none;
 border: none;
 max-width: 100%;
 overflow: hidden;
 width: 1em;
 line-height: inherit;
 cursor: pointer;
 color: var(--n-text-color);
 caret-color: var(--n-caret-color);
 `),e(`mirror`,`
 position: absolute;
 left: 0;
 top: 0;
 white-space: pre;
 visibility: hidden;
 user-select: none;
 -webkit-user-select: none;
 opacity: 0;
 `)]),[`warning`,`error`].map(t=>A(`${t}-status`,[e(`state-border`,`border: var(--n-border-${t});`),H(`disabled`,[w(`&:hover`,[e(`state-border`,`
 box-shadow: var(--n-box-shadow-hover-${t});
 border: var(--n-border-hover-${t});
 `)]),A(`active`,[e(`state-border`,`
 box-shadow: var(--n-box-shadow-active-${t});
 border: var(--n-border-active-${t});
 `),E(`base-selection-label`,`background-color: var(--n-color-active-${t});`),E(`base-selection-tags`,`background-color: var(--n-color-active-${t});`)]),A(`focus`,[e(`state-border`,`
 box-shadow: var(--n-box-shadow-focus-${t});
 border: var(--n-border-focus-${t});
 `)])])]))]),E(`base-selection-popover`,`
 margin-bottom: -3px;
 display: flex;
 flex-wrap: wrap;
 margin-right: -8px;
 `),E(`base-selection-tag-wrapper`,`
 max-width: 100%;
 display: inline-flex;
 padding: 0 7px 3px 0;
 `,[w(`&:last-child`,`padding-right: 0;`),E(`tag`,`
 font-size: 14px;
 max-width: 100%;
 `,[e(`content`,`
 line-height: 1.25;
 text-overflow: ellipsis;
 overflow: hidden;
 `)])])]),lt=[`disabled`,`value`,`autofocus`,`onBlur`,`onFocus`,`onKeydown`,`onInput`,`onCompositionstart`,`onCompositionend`],ut=[`tabindex`],dt=[`title`],ft=[`value`,`readonly`,`disabled`,`autofocus`,`onFocus`,`onBlur`,`onInput`,`onCompositionstart`,`onCompositionend`],pt=[`tabindex`],mt=[`onClick`,`onMouseenter`,`onMouseleave`,`onKeydown`,`onFocusin`,`onFocusout`,`onMousedown`],ht=P({name:`InternalSelection`,props:{...u.props,clsPrefix:{type:String,required:!0},bordered:{type:Boolean,default:void 0},active:Boolean,pattern:{type:String,default:``},placeholder:String,selectedOption:{type:Object,default:null},selectedOptions:{type:Array,default:null},labelField:{type:String,default:`label`},valueField:{type:String,default:`value`},multiple:Boolean,filterable:Boolean,clearable:Boolean,disabled:Boolean,size:{type:String,default:`medium`},loading:Boolean,autofocus:Boolean,showArrow:{type:Boolean,default:!0},inputProps:Object,focused:Boolean,renderTag:Function,onKeydown:Function,onClick:Function,onBlur:Function,onFocus:Function,onDeleteOption:Function,maxTagCount:[String,Number],ellipsisTagPopoverProps:Object,onClear:Function,onPatternInput:Function,onPatternFocus:Function,onPatternBlur:Function,renderLabel:Function,status:String,inlineThemeDisabled:Boolean,ignoreComposition:{type:Boolean,default:!0},onResize:Function},setup(e){let{mergedClsPrefixRef:t,mergedRtlRef:r}=ne(e),i=x(`InternalSelection`,r,t),a=z(null),s=z(null),c=z(null),l=z(null),d=z(null),f=z(null),p=z(null),m=z(null),h=z(null),g=z(null),_=z(!1),y=z(!1),b=z(!1),S=u(`InternalSelection`,`-internal-selection`,ct,ce,e,L(e,`clsPrefix`)),w=K(()=>e.clearable&&!e.disabled&&(b.value||e.active)),E=K(()=>e.selectedOption?e.renderTag?e.renderTag({option:e.selectedOption,handleClose:()=>{}}):e.renderLabel?e.renderLabel(e.selectedOption,!0):Y(e.selectedOption[e.labelField],e.selectedOption,!0):e.placeholder),ee=K(()=>{let t=e.selectedOption;if(t)return t[e.labelField]}),D=K(()=>e.multiple?!!(Array.isArray(e.selectedOptions)&&e.selectedOptions.length):e.selectedOption!==null);function O(){let{value:t}=a;if(t){let{value:n}=s;n&&(n.style.width=`${t.offsetWidth}px`,e.maxTagCount!==`responsive`&&h.value?.sync({showAllItemsBeforeCalculate:!1}))}}function k(){let{value:e}=g;e&&(e.style.display=`none`)}function A(){let{value:e}=g;e&&(e.style.display=`inline-block`)}T(L(e,`active`),e=>{e||k()}),T(L(e,`pattern`),()=>{e.multiple&&o(O)});function te(t){let{onFocus:n}=e;n&&n(t)}function j(t){let{onBlur:n}=e;n&&n(t)}function M(t){let{onDeleteOption:n}=e;n&&n(t)}function N(t){let{onClear:n}=e;n&&n(t)}function P(t){let{onPatternInput:n}=e;n&&n(t)}function F(e){e.relatedTarget&&c.value?.contains(e.relatedTarget)||te(e)}function R(e){c.value?.contains(e.relatedTarget)||j(e)}function B(e){N(e)}function V(){b.value=!0}function H(){b.value=!1}function U(t){e.active&&e.filterable&&t.target!==s.value&&t.preventDefault()}function W(e){M(e)}let G=z(!1);function q(t){if(t.key===`Backspace`&&!G.value&&!e.pattern.length){let{selectedOptions:t}=e;t?.length&&W(t[t.length-1])}}let J=null;function re(t){let{value:n}=a;n&&(n.textContent=t.target.value,O()),e.ignoreComposition&&G.value?J=t:P(t)}function ie(){G.value=!0}function ae(){G.value=!1,e.ignoreComposition&&P(J),J=null}function oe(t){y.value=!0,e.onPatternFocus?.(t)}function se(t){y.value=!1,e.onPatternBlur?.(t)}function Z(){if(e.filterable)y.value=!1,f.value?.blur(),s.value?.blur();else if(e.multiple){let{value:e}=l;e?.blur()}else{let{value:e}=d;e?.blur()}}function le(){e.filterable?(y.value=!1,f.value?.focus()):e.multiple?l.value?.focus():d.value?.focus()}function ue(){let{value:e}=s;e&&(A(),e.focus())}function Q(){let{value:e}=s;e&&e.blur()}function $(e){let{value:t}=p;t&&t.setTextContent(`+${e}`)}function de(){let{value:e}=m;return e}function fe(){return s.value}let pe=null;function me(){pe!==null&&window.clearTimeout(pe)}function he(){e.active||(me(),pe=window.setTimeout(()=>{D.value&&(_.value=!0)},100))}function ge(){me()}function _e(e){e||(me(),_.value=!1)}T(D,e=>{e||(_.value=!1)}),n(()=>{C(()=>{let t=f.value;t&&(e.disabled?t.removeAttribute(`tabindex`):t.tabIndex=y.value?-1:0)})}),Ke(c,e.onResize);let{inlineThemeDisabled:ve}=e,ye=K(()=>{let{size:t}=e,{common:{cubicBezierEaseInOut:n},self:{fontWeight:r,borderRadius:i,color:a,placeholderColor:o,textColor:s,paddingSingle:c,paddingMultiple:l,caretColor:u,colorDisabled:d,textColorDisabled:f,placeholderColorDisabled:p,colorActive:m,boxShadowFocus:h,boxShadowActive:g,boxShadowHover:_,border:v,borderFocus:y,borderHover:b,borderActive:x,arrowColor:C,arrowColorDisabled:w,loadingColor:T,colorActiveWarning:E,boxShadowFocusWarning:ee,boxShadowActiveWarning:D,boxShadowHoverWarning:O,borderWarning:k,borderFocusWarning:A,borderHoverWarning:te,borderActiveWarning:j,colorActiveError:M,boxShadowFocusError:ne,boxShadowActiveError:N,boxShadowHoverError:P,borderError:F,borderFocusError:L,borderHoverError:R,borderActiveError:z,clearColor:B,clearColorHover:V,clearColorPressed:H,clearSize:U,arrowSize:W,[I(`height`,t)]:G,[I(`fontSize`,t)]:K}}=S.value,q=X(c),J=X(l);return{"--n-bezier":n,"--n-border":v,"--n-border-active":x,"--n-border-focus":y,"--n-border-hover":b,"--n-border-radius":i,"--n-box-shadow-active":g,"--n-box-shadow-focus":h,"--n-box-shadow-hover":_,"--n-caret-color":u,"--n-color":a,"--n-color-active":m,"--n-color-disabled":d,"--n-font-size":K,"--n-height":G,"--n-padding-single-top":q.top,"--n-padding-multiple-top":J.top,"--n-padding-single-right":q.right,"--n-padding-multiple-right":J.right,"--n-padding-single-left":q.left,"--n-padding-multiple-left":J.left,"--n-padding-single-bottom":q.bottom,"--n-padding-multiple-bottom":J.bottom,"--n-placeholder-color":o,"--n-placeholder-color-disabled":p,"--n-text-color":s,"--n-text-color-disabled":f,"--n-arrow-color":C,"--n-arrow-color-disabled":w,"--n-loading-color":T,"--n-color-active-warning":E,"--n-box-shadow-focus-warning":ee,"--n-box-shadow-active-warning":D,"--n-box-shadow-hover-warning":O,"--n-border-warning":k,"--n-border-focus-warning":A,"--n-border-hover-warning":te,"--n-border-active-warning":j,"--n-color-active-error":M,"--n-box-shadow-focus-error":ne,"--n-box-shadow-active-error":N,"--n-box-shadow-hover-error":P,"--n-border-error":F,"--n-border-focus-error":L,"--n-border-hover-error":R,"--n-border-active-error":z,"--n-clear-size":U,"--n-clear-color":B,"--n-clear-color-hover":V,"--n-clear-color-pressed":H,"--n-arrow-size":W,"--n-font-weight":r}}),be=ve?v(`internal-selection`,K(()=>e.size[0]),ye,e):void 0;return{mergedTheme:S,mergedClearable:w,mergedClsPrefix:t,rtlEnabled:i,patternInputFocused:y,filterablePlaceholder:E,label:ee,selected:D,showTagsPanel:_,isComposing:G,counterRef:p,counterWrapperRef:m,patternInputMirrorRef:a,patternInputRef:s,selfRef:c,multipleElRef:l,singleElRef:d,patternInputWrapperRef:f,overflowRef:h,inputTagElRef:g,handleMouseDown:U,handleFocusin:F,handleClear:B,handleMouseEnter:V,handleMouseLeave:H,handleDeleteOption:W,handlePatternKeyDown:q,handlePatternInputInput:re,handlePatternInputBlur:se,handlePatternInputFocus:oe,handleMouseEnterCounter:he,handleMouseLeaveCounter:ge,handleFocusout:R,handleCompositionEnd:ae,handleCompositionStart:ie,onPopoverUpdateShow:_e,focus:le,focusInput:ue,blur:Z,blurInput:Q,updateCounter:$,getCounter:de,getTail:fe,renderLabel:e.renderLabel,cssVars:ve?void 0:ye,themeClass:be?.themeClass,onRender:be?.onRender}},render(){let{status:e,multiple:t,size:n,disabled:i,filterable:a,maxTagCount:o,bordered:s,clsPrefix:l,ellipsisTagPopoverProps:u,onRender:d,renderTag:f,renderLabel:p}=this;d?.();let m=o===`responsive`,h=typeof o==`number`,_=m||h,v=(c(),G(fe,null,{default:()=>(c(),G(re,{clsPrefix:l,loading:this.loading,showArrow:this.showArrow,showClear:this.mergedClearable&&this.selected,onClear:this.handleClear},{default:()=>this.$slots.arrow?.()},1032,[`clsPrefix`,`loading`,`showArrow`,`showClear`,`onClear`]))},1024)),y;if(t){let{labelField:e}=this,t=t=>(c(),r(`div`,{class:V(`${l}-base-selection-tag-wrapper`),key:t.value},[f?(c(),r(M,{key:0},[W(()=>f({option:t,handleClose:()=>{this.handleDeleteOption(t)}}))],64)):(c(),G(Ee,{key:1,size:n,closable:!t.disabled,disabled:i,onClose:()=>{this.handleDeleteOption(t)},internalCloseIsButtonTag:!1,internalCloseFocusable:!1},{default:()=>p?p(t,!0):Y(t[e],t,!0)},1032,[`size`,`closable`,`disabled`,`onClose`]))],2)),s=()=>(h?this.selectedOptions.slice(0,o):this.selectedOptions).map(t),d=a?(c(),r(`div`,{class:V(`${l}-base-selection-input-tag`),ref:`inputTagElRef`,key:`__input-tag__`},[D(`input`,g(this.inputProps,{ref:`patternInputRef`,tabindex:-1,disabled:i,value:this.pattern,autofocus:this.autofocus,class:`${l}-base-selection-input-tag__input`,onBlur:this.handlePatternInputBlur,onFocus:this.handlePatternInputFocus,onKeydown:this.handlePatternKeyDown,onInput:this.handlePatternInputInput,onCompositionstart:this.handleCompositionStart,onCompositionend:this.handleCompositionEnd}),null,16,lt),D(`span`,{ref:`patternInputMirrorRef`,class:V(`${l}-base-selection-input-tag__mirror`)},[W(()=>this.pattern)],2)],2)):null,b=m?()=>(c(),r(`div`,{class:V(`${l}-base-selection-tag-wrapper`),ref:`counterWrapperRef`},[(c(),G(Ee,{size:n,ref:`counterRef`,onMouseenter:this.handleMouseEnterCounter,onMouseleave:this.handleMouseLeaveCounter,disabled:i},null,8,[`size`,`onMouseenter`,`onMouseleave`,`disabled`]))],2)):void 0,x;if(h){let e=this.selectedOptions.length-o;e>0&&(x=(t=>(c(),r(`div`,{class:V(`${l}-base-selection-tag-wrapper`),key:`__counter__`},[(c(),G(Ee,{size:n,ref:`counterRef`,onMouseenter:this.handleMouseEnterCounter,disabled:i},{default:()=>`+${e}`},1032,[`size`,`onMouseenter`,`disabled`]))],2)))(x))}let S=m?a?(c(),G(Se,{key:3,ref:`overflowRef`,updateCounter:this.updateCounter,getCounter:this.getCounter,getTail:this.getTail,style:{width:`100%`,display:`flex`,overflow:`hidden`}},{default:s,counter:b,tail:()=>d},1032,[`updateCounter`,`getCounter`,`getTail`])):(c(),G(Se,{key:4,ref:`overflowRef`,updateCounter:this.updateCounter,getCounter:this.getCounter,style:{width:`100%`,display:`flex`,overflow:`hidden`}},{default:s,counter:b},1032,[`updateCounter`,`getCounter`])):h&&x?s().concat(x):s(),C=_?()=>(c(),r(`div`,{class:V(`${l}-base-selection-popover`)},[m?(c(),r(M,{key:0},[W(()=>s())],64)):(c(),r(M,{key:1},[W(()=>this.selectedOptions.map(t))],64))],2)):void 0,w=_?{show:this.showTagsPanel,trigger:`hover`,overlap:!0,placement:`top`,width:`trigger`,onUpdateShow:this.onPopoverUpdateShow,theme:this.mergedTheme.peers.Popover,themeOverrides:this.mergedTheme.peerOverrides.Popover,...u}:null,T=!this.selected&&(!this.active||!this.pattern&&!this.isComposing)?(c(),r(`div`,{key:5,class:V(`${l}-base-selection-placeholder ${l}-base-selection-overlay`)},[D(`div`,{class:V(`${l}-base-selection-placeholder__inner`)},[W(()=>this.placeholder)],2)],2)):null,E=a?(c(),r(`div`,{key:6,ref:`patternInputWrapperRef`,class:V(`${l}-base-selection-tags`)},[W(()=>S),m?W(()=>null):(c(),r(M,{key:1},[W(()=>d)],64)),W(()=>v)],2)):(c(),r(`div`,{key:7,ref:`multipleElRef`,class:V(`${l}-base-selection-tags`),tabindex:i?void 0:0},[W(()=>S),W(()=>v)],10,ut));y=(e=>(c(),r(M,{key:8},[_?(c(),G(xe,g({key:0},w,{scrollable:!0,style:`max-height: calc(var(--v-target-height) * 6.6);`}),{trigger:()=>E,default:C},1040)):(c(),r(M,{key:1},[W(()=>E)],64)),W(()=>T)],64)))(y)}else if(a){let e=this.pattern||this.isComposing,t=this.active?!e:!this.selected,n=!this.active&&this.selected;y=(e=>(c(),r(`div`,{key:9,ref:`patternInputWrapperRef`,class:V(`${l}-base-selection-label`),title:this.patternInputFocused?void 0:Ge(this.label)},[D(`input`,g(this.inputProps,{ref:`patternInputRef`,class:`${l}-base-selection-input`,value:this.active?this.pattern:``,placeholder:``,readonly:i,disabled:i,tabindex:-1,autofocus:this.autofocus,onFocus:this.handlePatternInputFocus,onBlur:this.handlePatternInputBlur,onInput:this.handlePatternInputInput,onCompositionstart:this.handleCompositionStart,onCompositionend:this.handleCompositionEnd}),null,16,ft),n?(c(),r(`div`,{class:V(`${l}-base-selection-label__render-label ${l}-base-selection-overlay`),key:`input`},[D(`div`,{class:V(`${l}-base-selection-overlay__wrapper`)},[f?(c(),r(M,{key:0},[W(()=>f({option:this.selectedOption,handleClose:()=>{}}))],64)):(c(),r(M,{key:1},[p?(c(),r(M,{key:0},[W(()=>p(this.selectedOption,!0))],64)):(c(),r(M,{key:1},[W(()=>Y(this.label,this.selectedOption,!0))],64))],64))],2)],2)):W(()=>null),t?(c(),r(`div`,{class:V(`${l}-base-selection-placeholder ${l}-base-selection-overlay`),key:`placeholder`},[D(`div`,{class:V(`${l}-base-selection-overlay__wrapper`)},[W(()=>this.filterablePlaceholder)],2)],2)):W(()=>null),W(()=>v)],10,dt)))(y)}else y=(e=>(c(),r(`div`,{key:10,ref:`singleElRef`,class:V(`${l}-base-selection-label`),tabindex:this.disabled?void 0:0},[this.label===void 0?(c(),r(`div`,{class:V(`${l}-base-selection-placeholder ${l}-base-selection-overlay`),key:`placeholder`},[D(`div`,{class:V(`${l}-base-selection-placeholder__inner`)},[W(()=>this.placeholder)],2)],2)):(c(),r(`div`,{class:V(`${l}-base-selection-input`),title:Ge(this.label),key:`input`},[D(`div`,{class:V(`${l}-base-selection-input__content`)},[f?(c(),r(M,{key:0},[W(()=>f({option:this.selectedOption,handleClose:()=>{}}))],64)):(c(),r(M,{key:1},[p?(c(),r(M,{key:0},[W(()=>p(this.selectedOption,!0))],64)):(c(),r(M,{key:1},[W(()=>Y(this.label,this.selectedOption,!0))],64))],64))],2)],10,[`title`])),W(()=>v)],10,pt)))(y);return c(),r(`div`,{ref:`selfRef`,class:V([`${l}-base-selection`,this.rtlEnabled&&`${l}-base-selection--rtl`,this.themeClass,e&&`${l}-base-selection--${e}-status`,{[`${l}-base-selection--active`]:this.active,[`${l}-base-selection--selected`]:this.selected||this.active&&this.pattern,[`${l}-base-selection--disabled`]:this.disabled,[`${l}-base-selection--multiple`]:this.multiple,[`${l}-base-selection--focus`]:this.focused}]),style:F(this.cssVars),onClick:this.onClick,onMouseenter:this.handleMouseEnter,onMouseleave:this.handleMouseLeave,onKeydown:this.onKeydown,onFocusin:this.handleFocusin,onFocusout:this.handleFocusout,onMousedown:this.handleMouseDown},[W(()=>y),s?(c(),r(`div`,{key:0,class:V(`${l}-base-selection__border`)},null,2)):W(()=>null),s?(c(),r(`div`,{key:2,class:V(`${l}-base-selection__state-border`)},null,2)):W(()=>null)],46,mt)}}),gt=w([E(`select`,`
 z-index: auto;
 outline: none;
 width: 100%;
 position: relative;
 font-weight: var(--n-font-weight);
 `),E(`select-menu`,`
 margin: 4px 0;
 box-shadow: var(--n-menu-box-shadow);
 `,[de({originalTransition:`background-color .3s var(--n-bezier), box-shadow .3s var(--n-bezier)`})])]),_t={...u.props,to:ye.propTo,bordered:{type:Boolean,default:void 0},clearable:Boolean,clearCreatedOptionsOnClear:{type:Boolean,default:!0},clearFilterAfterSelect:{type:Boolean,default:!0},options:{type:Array,default:()=>[]},defaultValue:{type:[String,Number,Array],default:null},keyboard:{type:Boolean,default:!0},value:[String,Number,Array],placeholder:String,menuProps:Object,multiple:Boolean,size:String,menuSize:{type:String},filterable:Boolean,disabled:{type:Boolean,default:void 0},remote:Boolean,loading:Boolean,filter:Function,placement:{type:String,default:`bottom-start`},widthMode:{type:String,default:`trigger`},tag:Boolean,onCreate:Function,fallbackOption:{type:[Function,Boolean],default:void 0},show:{type:Boolean,default:void 0},showArrow:{type:Boolean,default:!0},maxTagCount:[Number,String],ellipsisTagPopoverProps:Object,consistentMenuWidth:{type:Boolean,default:!0},virtualScroll:{type:Boolean,default:!0},labelField:{type:String,default:`label`},valueField:{type:String,default:`value`},childrenField:{type:String,default:`children`},renderLabel:Function,renderOption:Function,renderTag:Function,"onUpdate:value":[Function,Array],inputProps:Object,nodeProps:Function,ignoreComposition:{type:Boolean,default:!0},showOnFocus:Boolean,onUpdateValue:[Function,Array],onBlur:[Function,Array],onClear:[Function,Array],onFocus:[Function,Array],onScroll:[Function,Array],onSearch:[Function,Array],onUpdateShow:[Function,Array],"onUpdate:show":[Function,Array],displayDirective:{type:String,default:`show`},resetMenuOnOptionsChange:{type:Boolean,default:!0},status:String,showCheckmark:{type:Boolean,default:!0},scrollbarProps:Object,onChange:[Function,Array],items:Array},vt=P({name:`Select`,props:_t,slots:Object,setup(e){let{mergedClsPrefixRef:t,mergedBorderedRef:n,namespaceRef:r,inlineThemeDisabled:i,mergedComponentPropsRef:a}=ne(e),o=u(`Select`,`-select`,gt,ue,e,t),s=z(e.defaultValue),c=L(e,`value`),l=ie(c,s),f=z(!1),m=z(``),h=je(e,[`items`,`options`]),g=z([]),_=z([]),y=K(()=>_.value.concat(g.value).concat(h.value)),b=K(()=>{let{filter:t}=e;if(t)return t;let{labelField:n,valueField:r}=e;return(e,t)=>{if(!t)return!1;let i=t[n];if(typeof i==`string`)return it(e,i);let a=t[r];return typeof a==`string`?it(e,a):typeof a==`number`&&it(e,String(a))}}),x=K(()=>{if(e.remote)return h.value;{let{value:t}=y,{value:n}=m;return!n.length||!e.filterable?t:ot(t,b.value,n,e.childrenField)}}),S=K(()=>{let{valueField:t,childrenField:n}=e,r=at(t,n);return Oe(x.value,r)}),C=K(()=>st(y.value,e.valueField,e.childrenField)),w=z(!1),E=ie(L(e,`show`),w),D=z(null),O=z(null),k=z(null),{localeRef:A}=J(`Select`),te=K(()=>e.placeholder??A.value.placeholder),j=[],M=z(new Map),N=K(()=>{let{fallbackOption:t}=e;if(t===void 0){let{labelField:t,valueField:n}=e;return e=>({[t]:String(e),[n]:e})}return t===!1?!1:e=>Object.assign(t(e),{value:e})});function P(t){let n=e.remote,{value:r}=M,{value:i}=C,{value:a}=N,o=[];return t.forEach(e=>{if(i.has(e))o.push(i.get(e));else if(n&&r.has(e))o.push(r.get(e));else if(a){let t=a(e);t&&o.push(t)}}),o}let F=K(()=>{if(e.multiple){let{value:e}=l;return Array.isArray(e)?P(e):[]}return null}),I=K(()=>{let{value:t}=l;return!e.multiple&&!Array.isArray(t)?t===null?null:P([t])[0]||null:null}),R=ee(e,{mergedSize:t=>{let{size:n}=e;if(n)return n;let{mergedSize:r}=t||{};return r?.value?r.value:a?.value?.Select?.size||`medium`}}),{mergedSizeRef:B,mergedDisabledRef:V,mergedStatusRef:H}=R;function U(t,n){let{onChange:r,"onUpdate:value":i,onUpdateValue:a}=e,{nTriggerFormChange:o,nTriggerFormInput:c}=R;r&&d(r,t,n),a&&d(a,t,n),i&&d(i,t,n),s.value=t,o(),c()}function W(t){let{onBlur:n}=e,{nTriggerFormBlur:r}=R;n&&d(n,t),r()}function G(){let{onClear:t}=e;t&&d(t)}function q(t){let{onFocus:n,showOnFocus:r}=e,{nTriggerFormFocus:i}=R;n&&d(n,t),i(),r&&ce()}function re(t){let{onSearch:n}=e;n&&d(n,t)}function ae(t){let{onScroll:n}=e;n&&d(n,t)}function Y(){let{remote:t,multiple:n}=e;if(t){let{value:t}=M;if(n){let{valueField:n}=e;F.value?.forEach(e=>{t.set(e[n],e)})}else{let n=I.value;n&&t.set(n[e.valueField],n)}}}function X(t){let{onUpdateShow:n,"onUpdate:show":r}=e;n&&d(n,t),r&&d(r,t),w.value=t}function ce(){V.value||(X(!0),w.value=!0,e.filterable&&Ne())}function Z(){X(!1)}function le(){m.value=``,_.value=j}let Q=z(!1);function $(){e.filterable&&(Q.value=!0)}function de(){e.filterable&&(Q.value=!1,E.value||le())}function fe(){V.value||(E.value?e.filterable?Ne():Z():ce())}function pe(e){k.value?.selfRef?.contains(e.relatedTarget)||(f.value=!1,W(e),Z())}function me(e){q(e),f.value=!0}function he(){f.value=!0}function ge(e){D.value?.$el.contains(e.relatedTarget)||(f.value=!1,W(e),Z())}function ve(){D.value?.focus(),Z()}function be(e){E.value&&(D.value?.$el.contains(se(e))||Z())}function xe(t){if(!Array.isArray(t))return[];if(N.value)return Array.from(t);{let{remote:n}=e,{value:r}=C;if(n){let{value:e}=M;return t.filter(t=>r.has(t)||e.has(t))}return t.filter(e=>r.has(e))}}function Se(e){Ce(e.rawNode)}function Ce(t){if(V.value)return;let{tag:n,remote:r,clearFilterAfterSelect:i,valueField:a}=e;if(n&&!r){let{value:e}=_,t=e[0]||null;if(t){let e=g.value;e.length?e.push(t):g.value=[t],_.value=j}}if(r&&M.value.set(t[a],t),e.multiple){let e=xe(l.value),o=e.findIndex(e=>e===t[a]);if(~o){if(e.splice(o,1),n&&!r){let e=we(t[a]);~e&&(g.value.splice(e,1),i&&(m.value=``))}}else e.push(t[a]),i&&(m.value=``);U(e,P(e))}else{if(n&&!r){let e=we(t[a]);~e?g.value=[g.value[e]]:g.value=j}Me(),Z(),U(t[a],t)}}function we(t){return g.value.findIndex(n=>n[e.valueField]===t)}function Te(t){E.value||ce();let{value:n}=t.target;m.value=n;let{tag:r,remote:i}=e;if(re(n),r&&!i){if(!n){_.value=j;return}let{onCreate:t}=e,r=t?t(n):{[e.labelField]:n,[e.valueField]:n},{valueField:i,labelField:a}=e;h.value.some(e=>e[i]===r[i]||e[a]===r[a])||g.value.some(e=>e[i]===r[i]||e[a]===r[a])?_.value=j:_.value=[r]}}function Ee(t){t.stopPropagation();let{multiple:n,tag:r,remote:i,clearCreatedOptionsOnClear:a}=e;!n&&e.filterable&&Z(),r&&!i&&a&&(g.value=j),G(),n?U([],[]):U(null,null)}function De(e){_e(e,`action`)||_e(e,`empty`)||_e(e,`header`)||e.preventDefault()}function ke(e){ae(e)}function Ae(t){if(!e.keyboard)t.preventDefault();else switch(t.key){case` `:if(e.filterable)break;t.preventDefault();case`Enter`:if(!D.value?.isComposing){if(E.value){let t=k.value?.getPendingTmNode();t?Se(t):e.filterable||(Z(),Me())}else if(ce(),e.tag&&Q.value){let t=_.value[0];if(t){let n=t[e.valueField],{value:r}=l;e.multiple&&Array.isArray(r)&&r.includes(n)||Ce(t)}}}t.preventDefault();break;case`ArrowUp`:if(t.preventDefault(),e.loading)return;E.value&&k.value?.prev();break;case`ArrowDown`:if(t.preventDefault(),e.loading)return;E.value?k.value?.next():ce();break;case`Escape`:E.value&&(oe(t),Z()),D.value?.focus()}}function Me(){D.value?.focus()}function Ne(){D.value?.focusInput()}function Pe(){E.value&&O.value?.syncPosition()}Y(),T(L(e,`options`),Y);let Fe={focus:()=>{D.value?.focus()},focusInput:()=>{D.value?.focusInput()},blur:()=>{D.value?.blur()},blurInput:()=>{D.value?.blurInput()}},Ie=K(()=>{let{self:{menuBoxShadow:e}}=o.value;return{"--n-menu-box-shadow":e}}),Le=i?v(`select`,void 0,Ie,e):void 0;return{...Fe,mergedStatus:H,mergedClsPrefix:t,mergedBordered:n,namespace:r,treeMate:S,isMounted:p(),triggerRef:D,menuRef:k,pattern:m,uncontrolledShow:w,mergedShow:E,adjustedTo:ye(e),uncontrolledValue:s,mergedValue:l,followerRef:O,localizedPlaceholder:te,selectedOption:I,selectedOptions:F,mergedSize:B,mergedDisabled:V,focused:f,activeWithoutMenuOpen:Q,inlineThemeDisabled:i,onTriggerInputFocus:$,onTriggerInputBlur:de,handleTriggerOrMenuResize:Pe,handleMenuFocus:he,handleMenuBlur:ge,handleMenuTabOut:ve,handleTriggerClick:fe,handleToggle:Se,handleDeleteOption:Ce,handlePatternInput:Te,handleClear:Ee,handleTriggerBlur:pe,handleTriggerFocus:me,handleKeydown:Ae,handleMenuAfterLeave:le,handleMenuClickOutside:be,handleMenuScroll:ke,handleMenuKeydown:Ae,handleMenuMousedown:De,mergedTheme:o,cssVars:i?void 0:Ie,themeClass:Le?.themeClass,onRender:Le?.onRender}},render(){return c(),r(`div`,{class:V(`${this.mergedClsPrefix}-select`)},[i(we,null,{_:1,default:O(()=>[(c(),G(Te,null,{_:1,default:O(()=>(c(),G(ht,{ref:`triggerRef`,inlineThemeDisabled:this.inlineThemeDisabled,status:this.mergedStatus,inputProps:this.inputProps,clsPrefix:this.mergedClsPrefix,showArrow:this.showArrow,maxTagCount:this.maxTagCount,ellipsisTagPopoverProps:this.ellipsisTagPopoverProps,bordered:this.mergedBordered,active:this.activeWithoutMenuOpen||this.mergedShow,pattern:this.pattern,placeholder:this.localizedPlaceholder,selectedOption:this.selectedOption,selectedOptions:this.selectedOptions,multiple:this.multiple,renderTag:this.renderTag,renderLabel:this.renderLabel,filterable:this.filterable,clearable:this.clearable,disabled:this.mergedDisabled,size:this.mergedSize,theme:this.mergedTheme.peers.InternalSelection,labelField:this.labelField,valueField:this.valueField,themeOverrides:this.mergedTheme.peerOverrides.InternalSelection,loading:this.loading,focused:this.focused,onClick:this.handleTriggerClick,onDeleteOption:this.handleDeleteOption,onPatternInput:this.handlePatternInput,onClear:this.handleClear,onBlur:this.handleTriggerBlur,onFocus:this.handleTriggerFocus,onKeydown:this.handleKeydown,onPatternBlur:this.onTriggerInputBlur,onPatternFocus:this.onTriggerInputFocus,onResize:this.handleTriggerOrMenuResize,ignoreComposition:this.ignoreComposition},{_:1,arrow:O(()=>[this.$slots.arrow?.()])},8,`inlineThemeDisabled.status.inputProps.clsPrefix.showArrow.maxTagCount.ellipsisTagPopoverProps.bordered.active.pattern.placeholder.selectedOption.selectedOptions.multiple.renderTag.renderLabel.filterable.clearable.disabled.size.theme.labelField.valueField.themeOverrides.loading.focused.onClick.onDeleteOption.onPatternInput.onClear.onBlur.onFocus.onKeydown.onPatternBlur.onPatternFocus.onResize.ignoreComposition`.split(`.`))))})),(c(),G(Ce,{ref:`followerRef`,show:this.mergedShow,to:this.adjustedTo,teleportDisabled:this.adjustedTo===ye.tdkey,containerClass:this.namespace,width:this.consistentMenuWidth?`target`:void 0,minWidth:`target`,placement:this.placement},{_:1,default:O(()=>(c(),G(B,{name:`fade-in-scale-up-transition`,appear:this.isMounted,onAfterLeave:this.handleMenuAfterLeave},{_:1,default:O(()=>this.mergedShow||this.displayDirective===`show`?(this.onRender?.(),_((c(),G(tt,g(this.menuProps,{ref:`menuRef`,onResize:this.handleTriggerOrMenuResize,inlineThemeDisabled:this.inlineThemeDisabled,virtualScroll:this.consistentMenuWidth&&this.virtualScroll,class:[`${this.mergedClsPrefix}-select-menu`,this.themeClass,this.menuProps?.class],clsPrefix:this.mergedClsPrefix,focusable:!0,labelField:this.labelField,valueField:this.valueField,autoPending:!0,nodeProps:this.nodeProps,theme:this.mergedTheme.peers.InternalSelectMenu,themeOverrides:this.mergedTheme.peerOverrides.InternalSelectMenu,treeMate:this.treeMate,multiple:this.multiple,size:this.menuSize,renderOption:this.renderOption,renderLabel:this.renderLabel,value:this.mergedValue,style:[this.menuProps?.style,this.cssVars],onToggle:this.handleToggle,onScroll:this.handleMenuScroll,onFocus:this.handleMenuFocus,onBlur:this.handleMenuBlur,onKeydown:this.handleMenuKeydown,onTabOut:this.handleMenuTabOut,onMousedown:this.handleMenuMousedown,show:this.mergedShow,showCheckmark:this.showCheckmark,resetMenuOnOptionsChange:this.resetMenuOnOptionsChange,scrollbarProps:this.scrollbarProps}),{_:1,empty:O(()=>[this.$slots.empty?.()]),header:O(()=>[this.$slots.header?.()]),action:O(()=>[this.$slots.action?.()])},16,`onResize.inlineThemeDisabled.virtualScroll.class.clsPrefix.labelField.valueField.nodeProps.theme.themeOverrides.treeMate.multiple.size.renderOption.renderLabel.value.style.onToggle.onScroll.onFocus.onBlur.onKeydown.onTabOut.onMousedown.show.showCheckmark.resetMenuOnOptionsChange.scrollbarProps`.split(`.`))),this.displayDirective===`show`?[[k,this.mergedShow],[he,this.handleMenuClickOutside,void 0,{capture:!0}]]:[[he,this.handleMenuClickOutside,void 0,{capture:!0}]])):null)},8,[`appear`,`onAfterLeave`])))},8,[`show`,`to`,`teleportDisabled`,`containerClass`,`width`,`placement`]))])})],2)}}),yt={class:`page`},bt={class:`page-header`},xt={class:`page-heading`},St={class:`page-title`},Ct={key:0,class:`page-desc`},wt={key:0,class:`page-extra`},Tt={class:`page-body`},Et=ae(P({__name:`PageContainer`,props:{title:{},description:{}},setup(e){return(t,n)=>(c(),r(`div`,yt,[D(`header`,bt,[D(`div`,xt,[D(`h1`,St,U(e.title),1),e.description?(c(),r(`p`,Ct,U(e.description),1)):b(``,!0)]),t.$slots.extra?(c(),r(`div`,wt,[s(t.$slots,`extra`,{},void 0,!0)])):b(``,!0)]),D(`div`,Tt,[s(t.$slots,`default`,{},void 0,!0)])]))}}),[[`__scopeId`,`data-v-109f9ccb`]]);export{qe as a,tt as i,vt as n,Ge as o,at as r,We as s,Et as t};