// netlify/functions/brickset.js
// Serverless proxy for the Brickset API.
// Brickset does not send CORS headers, so browser fetch() is blocked.
// This function runs server-side, calls Brickset, and returns the result
// with CORS headers so the frontend can consume it.
//
// Usage: GET /.netlify/functions/brickset?setNumber=10497-1
//
// Deploy: just drop this file in netlify/functions/ — Netlify auto-detects it.
// No extra config needed if you're already on Netlify.

const BRICKSET_API_KEY = '3-lNuI-wkoZ-HDgqP';
const BRICKSET_ENDPOINT = 'https://brickset.com/api/v3.asmx/getSets';

exports.handler = async (event) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: corsHeaders, body: '' };
    }

    const { setNumber } = event.queryStringParameters || {};

    if (!setNumber) {
        return {
            statusCode: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Missing setNumber parameter' }),
        };
    }

    // Strip trailing variant suffix for Brickset (e.g. "10497-1" → "10497")
    const num = setNumber.replace(/-\d+$/, '');

    try {
        const params = JSON.stringify({ setNumber: num, pageSize: 1 });
        const url = `${BRICKSET_ENDPOINT}?apiKey=${BRICKSET_API_KEY}&userHash=&params=${encodeURIComponent(params)}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error(`Brickset returned ${res.status}`);

        const data = await res.json();
        const sets = data.sets || [];

        // Return only the price fields we need — keep payload tiny
        const result = sets.length > 0 ? {
            setNumber: sets[0].number,
            name: sets[0].name,
            year: sets[0].year,
            retailPrice: sets[0]?.LEGOCom?.US?.retailPrice ?? null,
            retailPriceCA: sets[0]?.LEGOCom?.CA?.retailPrice ?? null,
            retailPriceUK: sets[0]?.LEGOCom?.UK?.retailPrice ?? null,
            retailPriceDE: sets[0]?.LEGOCom?.DE?.retailPrice ?? null,
        } : null;

        return {
            statusCode: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ result }),
        };
    } catch (err) {
        return {
            statusCode: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: err.message }),
        };
    }
};
