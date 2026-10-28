import{r as e}from"./http-C6f9oGLa.js";var t=[{key:`monthly`,legacy:`month_price`,label:`月付`,orderLabel:`月付`,unit:`元/月`,months:1,discount:1},{key:`quarterly`,legacy:`quarter_price`,label:`季付`,orderLabel:`季付`,unit:`元/季`,months:3,discount:.95},{key:`half_yearly`,legacy:`half_year_price`,label:`半年付`,orderLabel:`半年付`,unit:`元/半年`,months:6,discount:.9},{key:`yearly`,legacy:`year_price`,label:`年付`,orderLabel:`年付`,unit:`元/年`,months:12,discount:.85},{key:`two_yearly`,legacy:`two_year_price`,label:`两年付`,orderLabel:`两年付`,unit:`元/两年`,months:24,discount:.8},{key:`three_yearly`,legacy:`three_year_price`,label:`三年付`,orderLabel:`三年付`,unit:`元/三年`,months:36,discount:.75},{key:`onetime`,legacy:`onetime_price`,label:`流量包`,orderLabel:`一次性`,unit:``,months:1,discount:1},{key:`reset_traffic`,legacy:`reset_price`,label:`重置包`,orderLabel:`流量重置包`,unit:`元/次`,months:1,discount:1}],n=Object.fromEntries(t.map(e=>[e.key,e])),r=Object.fromEntries(t.map(e=>[e.legacy,e])),i=[{value:null,label:`跟随系统设置`,userText:`按系统设置`},{value:0,label:`每月 1 号`,userText:`每月1号`},{value:1,label:`每月购买日`,userText:`按月`},{value:2,label:`不重置`,userText:`不重置`},{value:3,label:`每年 1 月 1 日`,userText:`每年1月1日`},{value:4,label:`每年购买日`,userText:`按年`}],a=`## 套餐详情

- 流量：{{transfer}} GB
- 速度限制：{{speed}} Mbps
- 同时在线设备：{{devices}} 台

## 服务说明

1. 流量{{reset_method}}重置
2. 支持多平台使用
3. 7×24小时技术支持
`;function o(e){return i.find(t=>t.value===(e??null))?.label??String(e)}function s(e){let n={},r=e.prices;if(!r||Array.isArray(r))return n;for(let e of t){let t=r[e.key];if(t==null||t===``)continue;let i=Number(t);Number.isFinite(i)&&(n[e.key]=i)}return n}function c(){return e.get(`/plan/fetch`)}function l(t){return e.post(`/plan/save`,t)}function u(t){return e.post(`/plan/update`,t)}function d(t){return e.post(`/plan/drop`,{id:t})}function f(t){return e.post(`/plan/sort`,{ids:t})}function p(t){return e.post(`/server/group/save`,{name:t})}export{i as a,c,l as d,f,t as i,s as l,r as n,p as o,u as p,a as r,d as s,n as t,o as u};