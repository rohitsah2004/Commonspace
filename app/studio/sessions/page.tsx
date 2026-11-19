import { requireChatGPTUser } from '../../chatgpt-auth';
import { isOwner } from '../../../lib/server';
import { Shell } from '../../ui';
import Sessions from './sessions';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Session logs', robots: { index: false, follow: false } };
export default async function Page() {
  await requireChatGPTUser('/studio/sessions');
  if (!await isOwner()) return <Shell><div className="content"><h1>Owner access required.</h1></div></Shell>;
  return <Shell owner studio><Sessions/></Shell>;
}
