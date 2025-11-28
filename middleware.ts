import { next } from '@vercel/edge';

export const config = {
  matcher: '/',
};

export default async function middleware(request: Request) {
  const url = new URL(request.url);
  const season = url.searchParams.get('season');
  const ref = url.searchParams.get('ref');

  // Fetch the actual static index.html response
  const response = await next(request);

  // If no params to inject, return the static file as is
  if (!season && !ref) {
    return response;
  }

  // Ensure we are processing HTML
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('text/html')) {
    return response;
  }

  // Read the HTML content
  let text = await response.text();

  // Construct the dynamic URL with parameters
  // NOTE: You should ensure this matches your production domain
  const baseUrl = 'https://2048-base.vercel.app/';
  const newUrl = new URL(baseUrl);
  if (season) newUrl.searchParams.set('season', season);
  if (ref) newUrl.searchParams.set('ref', ref);

  // Replace the static URL in the fc:miniapp JSON with the dynamic one
  // We look for the "url" field inside the action object
  const regex = /("action":\s*\{[^}]*"url":\s*")([^"]+)(")/;
  text = text.replace(regex, `$1${newUrl.toString()}$3`);

  return new Response(text, {
    headers: response.headers,
    status: response.status,
  });
}