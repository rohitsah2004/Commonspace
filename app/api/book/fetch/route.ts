import { authorizeWrite, database, json } from '../../../../lib/server';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { sessionJSON } from '../../../../lib/session-input';
import { bookURL, streamPDF, BookFetchError } from '../../../../lib/book/fetch-pdf';
import { claimBookQuota } from '../../../../lib/book/quota';
export async function POST(request: Request) {
    try {
        const denied = await authorizeWrite(request);
        if (denied)
            return denied;
        const user = await getChatGPTUser();
        if (!user)
            return json({ error: 'Owner access required.' }, 403);
        let url: string;
        try {
            if (Number(request.headers.get('content-length')) > 14000)
                throw Error();
            const value = await sessionJSON(request);
            if (Object.keys(value).length !== 1 || typeof value.url !== 'string')
                throw Error();
            url = bookURL(value.url).href;
        }
        catch {
            return json({ error: 'Provide a direct public HTTPS PDF link.' }, 400);
        }
        const quota = await claimBookQuota(database(), user.userId, 'book-fetch');
        if (!quota.claimed)
            return json({ error: 'Daily PDF link limit reached (20). Try again after midnight UTC.' }, 429);
        return await streamPDF(url, request.signal);
    }
    catch (error) {
        return json({ error: error instanceof BookFetchError ? error.message : 'PDF link import is unavailable. Try again later.' }, error instanceof BookFetchError ? error.status : 503);
    }
}
