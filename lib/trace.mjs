import {randomUUID} from 'node:crypto';
export function traceStore(){const traces=new Map();return {
 start(traceId,from,to,method,url,body,headers={}){const record={id:randomUUID(),traceId,from,to,request:{method,url,headers,...(body!==undefined?{body}:{})},state:'pending',startedAt:new Date().toISOString(),startedMs:performance.timeOrigin+performance.now()};if(!traces.has(traceId))traces.set(traceId,[]);traces.get(traceId).push(record);if(traces.size>200)traces.delete(traces.keys().next().value);return record;},
 finish(record,status,body,headers={}){record.finishedMs=performance.timeOrigin+performance.now();record.state='complete';record.response={status,headers,body};record.durationMs=Math.round(record.finishedMs-record.startedMs);return record;},
 get(id){return traces.get(id)||[];},
 all(){return [...traces.values()].flat();}
};}
export function traceId(req){const id=req.headers['x-demo-trace-id'];return typeof id==='string'&&/^[\w-]{1,80}$/.test(id)?id:randomUUID();}
