import {forMode} from '../lib/modes.mjs';
import Playground from './playground';
import {config,publicConfig} from '../lib/config.mjs';
export const dynamic='force-dynamic';
export default function Page(){const c=config();let testnetReady=false;try{testnetReady=forMode(c,'testnet').paymentReady;}catch{}return <Playground configuration={{...publicConfig(c),testnetReady}}/>;}
