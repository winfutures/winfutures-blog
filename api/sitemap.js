module.exports = async (req, res) => {
  try {
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || 'main';

    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/posts.json`;
    const postsRes = await fetch(rawUrl);
    const posts = postsRes.ok ? await postsRes.json() : [];

    const baseUrl = 'https://winfutures-blog.vercel.app';

    let urls = `  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
`;

    posts.forEach(p => {
      const lastmod = new Date(p.editedAt || p.date).toISOString().split('T')[0];
      urls += `  <url>
    <loc>${baseUrl}/post.html?id=${p.id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
`;
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}</urlset>`;

    res.setHeader('Content-Type', 'application/xml');
    res.status(200).send(xml);
  } catch (err) {
    res.status(500).send('<?xml version="1.0"?><error>' + (err.message || 'error') + '</error>');
  }
};
