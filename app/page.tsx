import Home from './home';import {isOwner} from '../lib/server';import {publicItems,toCard} from '../lib/queries';
export const dynamic='force-dynamic';export default async function Page(){return <Home posts={(await publicItems()).map(toCard)} owner={await isOwner()}/>;}
