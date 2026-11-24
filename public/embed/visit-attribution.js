// Shared visit session on the apex /market proxy, agent pages and embeds.
// Attribution failure must never block an existing signup.
const url='https://agentsautomated.com/visit-attribution.js';
const ready=Promise.race([import(/* @vite-ignore */ url).catch(()=>null),new Promise(resolve=>setTimeout(()=>resolve(null),2000))]);
export async function capture(){(await ready)?.captureVisit();}
export async function signup(){return (await ready)?.signupAttribution()||{};}
