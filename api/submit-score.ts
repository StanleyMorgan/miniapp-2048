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
  
  const getDomain = () => {
    // Vercel provides the VERCEL_URL env var, which contains the domain of the deployment.
    const vercelUrl = process.env.VERCEL_URL;
    if (vercelUrl) {
      return vercelUrl;
    }
    // Fallback for local development when not running on Vercel.
    return 'localhost:5173';
  };
  const domain = getDomain();
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
    
    // Step 2: Save the score to the database using an "UPSERT" operation.
    // This SQL command will INSERT a new row if the FID doesn't exist.
    // If the FID already exists (ON CONFLICT), it will UPDATE the existing row,
    // but only if the new score is greater than the current score.
    // This prevents users from submitting lower scores.
    await sql`
      INSERT INTO scores (fid, score, updated_at)
      VALUES (${fid}, ${score}, NOW())
      ON CONFLICT (fid)
      DO UPDATE SET
        score = EXCLUDED.score,
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