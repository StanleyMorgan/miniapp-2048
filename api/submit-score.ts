import { sql } from '@vercel/postgres';
import { Errors, createClient } from '@farcaster/quick-auth';

// Initialize the Farcaster Quick Auth client.
const quickAuthClient = createClient();

export async function POST(request: Request) {
  const authorization = request.headers.get('Authorization');
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ message: 'Missing or invalid authorization token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  // Determine the domain from the request's Host header for reliable verification.
  const host = request.headers.get('Host');
  if (!host) {
    console.error(`[submit-score] Missing Host header.`);
    return new Response(JSON.stringify({ message: 'Bad Request: Missing Host header' }), { status: 400 });
  }
  const domain = host;
  const token = authorization.split(' ')[1];

  // Enhanced logging for debugging
  console.log(`[submit-score] Attempting to verify token. Domain: "${domain}". Token starts with: "${token.substring(0, 10)}..."`);

  try {
    // Step 1: Verify the JWT from the request header.
    const payload = await quickAuthClient.verifyJwt({
      token: token,
      domain: domain, 
    });

    // The 'sub' property of the JWT payload contains the user's Farcaster ID (FID).
    const fid = payload.sub;
    const { score } = await request.json();

    // Basic validation for the score.
    if (typeof score !== 'number' || score < 0) {
      return new Response(JSON.stringify({ message: 'Invalid score provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Step 2: Fetch the username from Warpcast's public API.
    let username: string | null = null;
    try {
      const userResponse = await fetch(`https://api.warpcast.com/v2/user-by-fid?fid=${fid}`);
      if (userResponse.ok) {
        const userData = await userResponse.json();
        if (userData && userData.result && userData.result.user) {
          username = userData.result.user.username;
          console.log(`[submit-score] Fetched username "${username}" for FID ${fid}`);
        }
      } else {
         console.warn(`[submit-score] Could not fetch username for FID ${fid}. Status: ${userResponse.status}`);
      }
    } catch (fetchError) {
      console.error(`[submit-score] Error fetching username for FID ${fid}:`, fetchError);
    }

    // Step 3: Fetch the user's primary Ethereum address.
    let primaryAddress: string | null = null;
    try {
      const addressResponse = await fetch(`https://api.farcaster.xyz/fc/primary-address?fid=${fid}&protocol=ethereum`);
      if (addressResponse.ok) {
        const addressData = await addressResponse.json();
        if (addressData && addressData.result && addressData.result.address) {
          primaryAddress = addressData.result.address.address;
          console.log(`[submit-score] Fetched primary address "${primaryAddress}" for FID ${fid}`);
        }
      } else {
        console.warn(`[submit-score] Could not fetch primary address for FID ${fid}. Status: ${addressResponse.status}`);
      }
    } catch (fetchError) {
       console.error(`[submit-score] Error fetching primary address for FID ${fid}:`, fetchError);
    }
    
    // Step 4: Save the score, username, and address to the database using an "UPSERT" operation.
    // This SQL command will INSERT a new row if the FID doesn't exist.
    // If the FID already exists (ON CONFLICT), it will UPDATE the existing row,
    // but only if the new score is greater than the current score.
    // This prevents users from submitting lower scores.
    await sql`
      INSERT INTO scores (fid, username, score, primary_address, updated_at)
      VALUES (${fid}, ${username}, ${score}, ${primaryAddress}, NOW())
      ON CONFLICT (fid)
      DO UPDATE SET
        score = EXCLUDED.score,
        username = EXCLUDED.username,
        primary_address = EXCLUDED.primary_address,
        updated_at = NOW()
      WHERE
        scores.score < EXCLUDED.score;
    `;

    return new Response(JSON.stringify({ success: true, message: `Score for FID ${fid} has been processed.` }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (e) {
    if (e instanceof Errors.InvalidTokenError) {
      // Enhanced logging for debugging
      console.error(`[submit-score] Invalid token error for domain "${domain}". Full error:`, e);
      return new Response(JSON.stringify({ message: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    // For any other unexpected errors, return a 500 Internal Server Error.
    console.error(`[submit-score] An unexpected error occurred for domain "${domain}":`, e);
    return new Response(JSON.stringify({ message: 'An unexpected error occurred' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}