// This API endpoint is designed to be lightweight and fast, returning essential user info.
export const dynamic = 'force-dynamic';

import { Errors, createClient } from '@farcaster/quick-auth';

type UserInfo = {
  fid: number | null;
  primaryAddress: string | null;
};

export async function GET(request: Request) {
  const quickAuthClient = createClient();
  const authorization = request.headers.get('Authorization');
  let userInfo: UserInfo = { fid: null, primaryAddress: null };

  if (!authorization || !authorization.startsWith('Bearer ')) {
    // Return default info if the user is not authenticated.
    return new Response(JSON.stringify(userInfo), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const token = authorization.split(' ')[1];
  const host = request.headers.get('Host');

  if (!host) {
    console.error(`[user-info] Missing Host header.`);
    return new Response(JSON.stringify({ message: 'Bad Request: Missing Host header' }), { status: 400 });
  }
  const domain = host;

  try {
    const payload = await quickAuthClient.verifyJwt({ token, domain });
    const fid = Number(payload.sub);
    userInfo.fid = fid;

    // Fetch the user's primary Ethereum address.
    try {
      const addressResponse = await fetch(`https://api.farcaster.xyz/fc/primary-address?fid=${fid}&protocol=ethereum`);
      if (addressResponse.ok) {
        const addressData = await addressResponse.json();
        if (addressData.result && addressData.result.address) {
          userInfo.primaryAddress = addressData.result.address.address;
        }
      }
    } catch (fetchError) {
      console.error(`[user-info] Error fetching primary address for FID ${fid}:`, fetchError);
      // Don't fail the request, just return without an address.
    }
  } catch (e) {
    if (e instanceof Errors.InvalidTokenError) {
      console.warn(`[user-info] Invalid token received for domain "${domain}".`, e.message);
      // Treat as unauthenticated.
    } else {
      console.error(`[user-info] Unexpected error verifying JWT for domain "${domain}":`, e);
    }
  }

  return new Response(JSON.stringify(userInfo), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
