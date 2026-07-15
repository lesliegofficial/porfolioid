// ============================================================
// PorfolioID — cloudinary-browse.js
// RETIRED — Cloudinary browsing has been retired following the
// R2 migration. This endpoint intentionally performs no Cloudinary
// SDK initialization and makes no outbound request of any kind.
// It exists only so the previously-deployed function path returns
// a clear, safe response instead of a stale credential-backed handler.
// ============================================================

exports.handler = async () => {
  return {
    statusCode: 410,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      success: false,
      error: 'Cloudinary browsing has been retired. Use the R2 upload controls.',
    }),
  };
};
