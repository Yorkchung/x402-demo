export const airports={TPE:'台北桃園',NRT:'東京成田',ICN:'首爾仁川',SIN:'新加坡樟宜'};
export function flightQuery(search=new URLSearchParams()){
 const origin=search.get('origin')||'TPE',destination=search.get('destination')||'NRT';
 const date=search.get('date')||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 if(!airports[origin]||!airports[destination]||origin===destination)throw Error('請選擇不同的支援機場');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw Error('Invalid flight date');
 return {origin,destination,date};
}
export const queryString=query=>new URLSearchParams(query).toString();
const zones={TPE:{offset:8,name:'Asia/Taipei'},NRT:{offset:9,name:'Asia/Tokyo'},ICN:{offset:9,name:'Asia/Seoul'},SIN:{offset:8,name:'Asia/Singapore'}};
export function flightData(query){
 const origin=zones[query.origin],destination=zones[query.destination];
 const flights=[{id:'DEMO-101',airline:'Demo Pacific',flightNumber:'DP101',time:'09:00',durationMinutes:210,aircraft:'Airbus A321',price:{amount:6200,currency:'TWD'}},{id:'DEMO-205',airline:'Demo Airways',flightNumber:'DA205',time:'14:20',durationMinutes:205,aircraft:'Boeing 787',price:{amount:7800,currency:'TWD'}}].map(({time,...flight})=>{const departure=`${query.date}T${time}:00+0${origin.offset}:00`,arrival=new Date(Date.parse(departure)+flight.durationMinutes*60000+destination.offset*3600000).toISOString().slice(0,19)+`+0${destination.offset}:00`;return {...flight,origin:query.origin,destination:query.destination,departure,arrival,departureTimezone:origin.name,arrivalTimezone:destination.name,status:'Scheduled'};});
 return {source:'fixture',isLiveFlightData:false,notice:'固定測試資料，非即時班表、票價或可訂位資訊。',query,flights};
}
