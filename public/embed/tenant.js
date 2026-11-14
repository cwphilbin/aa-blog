import {initSurface} from './report-kit/controller.js';
const data=JSON.parse(document.querySelector('#aa-tenant-data').textContent);
const root=document.querySelector('[data-tenant-surface]');
initSurface(root,data);
document.querySelector('[data-tenant-signup]')?.addEventListener('click',e=>{e.preventDefault();document.querySelector('#aa-email')?.focus({preventScroll:true});});
