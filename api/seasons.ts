
import { sql } from '@vercel/postgres';
import type { SeasonInfo } from '../types';

export const dynamic = 'force-dynamic';

// Helper function to convert snake_case keys from DB to camelCase for JS/TS
const toCamelCase = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(v => toCamelCase(v));
  } else if (obj !== null && obj.constructor === Object) {
    return Object.keys(obj).reduce((result, key) => {
      const camelKey = key.replace(/([-_][a-z])/ig, ($1) => {
        return $1.toUpperCase()
          .replace('-', '')
          .replace('_', '');
      });
      result[camelKey] = toCamelCase(obj[key]);
      return result;
    }, {} as {[key: string]: any});
  }
  return obj;
};


export async function GET(request: Request) {
  try {
    // Fetch all enabled seasons, ordered by the specified sort order.
    const { rows } = await sql`
      SELECT 
        id, 
        name,
        is_enabled,
        is_default,
        contract_address,
        chain_id,
        chain_name,
        prize_pool,
        prize_unit,
        share_name,
        start_date,
        end_date,
        sort_order
      FROM seasons 
      WHERE is_enabled = TRUE 
      ORDER BY sort_order ASC;
    `;

    // The vercel/postgres driver returns snake_case keys. We convert them to camelCase.
    const seasons: SeasonInfo[] = rows.map(toCamelCase);

    return new Response(JSON.stringify(seasons), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        // Cache for 5 minutes to reduce DB load but allow for reasonably fast updates
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });

  } catch (error) {
    console.error('[api/seasons] Database error:', error);
    return new Response(JSON.stringify({ message: 'Error fetching seasons data.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
