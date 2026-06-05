// Netlify Function: upload-pdf
// Receives a PDF file as base64, saves to GitHub repo, returns public URL
// This ensures PDFs are always publicly accessible — Cloudinary raw files require auth

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { fileData, fileName, folder } = JSON.parse(event.body);
    if (!fileData || !fileName) {
      return { statusCode: 400, body: JSON.stringify({ error: 'fileData and fileName required' }) };
    }

    const GITHUB_TOKEN = process.env.GITHUB_BACKUP_TOKEN;
    const GITHUB_REPO = process.env.GITHUB_BACKUP_REPO || 'lesliegofficial/porfolioid';

    if (!GITHUB_TOKEN) {
      return { statusCode: 500, body: JSON.stringify({ error: 'GitHub token not configured' }) };
    }

    // Sanitize filename — remove special chars, keep extension
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase();
    const subFolder = folder || 'press';
    const filePath = `${subFolder}/${Date.now()}_${safeName}`;

    // Check if file already exists (get SHA for update)
    let sha = null;
    try {
      const checkRes = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`,
        { headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'User-Agent': 'porfolioid' } }
      );
      if (checkRes.ok) {
        const existing = await checkRes.json();
        sha = existing.sha;
      }
    } catch(e) {}

    // Upload to GitHub
    const body = {
      message: `Press archive upload: ${safeName}`,
      content: fileData, // already base64
    };
    if (sha) body.sha = sha;

    const uploadRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
          'User-Agent': 'porfolioid'
        },
        body: JSON.stringify(body)
      }
    );

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      return { statusCode: 500, body: JSON.stringify({ error: `GitHub upload failed: ${err}` }) };
    }

    // Return public raw URL
    const publicUrl = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/${filePath}`;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, url: publicUrl, path: filePath })
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
