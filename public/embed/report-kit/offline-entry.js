import {initSurface} from './controller.js';
const root=document.querySelector('[data-aa-surface]');const data=JSON.parse(document.querySelector('#aa-data').textContent);initSurface(root,data);
