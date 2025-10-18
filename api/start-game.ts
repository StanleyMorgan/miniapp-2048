// This API endpoint provides the necessary external randomness and a secure timestamp
// to ensure each game session is unique, deterministic, and verifiable.
export const dynamic = 'force-dynamic';

// Drand is a distributed randomness beacon network. Using it prevents players
// from manipulating the game's seed.
const DRAND_URL = 'https://api.drand.sh/public/latest';

export async function GET(request: Request) {
  try {
    const drandResponse = await fetch(DRAND_URL, {
      // Use a short timeout to avoid long waits if drand is unresponsive.
      signal: AbortSignal.timeout(3000), 
    });

    if (!drandResponse.ok) {
      throw new Error(`Drand fetch failed with status: ${drandResponse.status}`);
    }

    const drandData = await drandResponse.json();
    const randomness = drandData.randomness; // This is a hex string

    if (typeof randomness !== 'string' || randomness.length === 0) {
      throw new Error('Invalid randomness value received from Drand');
    }

    // Using a server-generated timestamp prevents manipulation of the game's start time.
    const startTime = Date.now();

    return new Response(JSON.stringify({ randomness, startTime }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[start-game] Error fetching start game data:', error);
    const errorResponse = { message: 'Could not initialize a new game. Please try again.' };
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}