module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || 'main';
    const token = process.env.GITHUB_TOKEN;
    const filePath = 'stats.json';
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

    let stats = { total: 0, daily: {} };
    let sha;

    const getRes = await fetch(`${apiUrl}?ref=${branch}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json'
      }
    });
    if (getRes.ok) {
      const getData = await getRes.json();
      sha = getData.sha;
      stats = JSON.parse(Buffer.from(getData.content, 'base64').toString('utf-8'));
    }

    const today = new Date().toISOString().split('T')[0];
    stats.total = (stats.total || 0) + 1;
    stats.daily = stats.daily || {};
    stats.daily[today] = (stats.daily[today] || 0) + 1;

    const newContentBase64 = Buffer.from(JSON.stringify(stats, null, 2)).toString('base64');
    const putBody = {
      message: '방문 기록 업데이트',
      content: newContentBase64,
      branch
    };
    if (sha) putBody.sha = sha;

    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json'
      },
      body: JSON.stringify(putBody)
    });

    if (!putRes.ok) {
      const errText = await putRes.text();
      throw new Error(errText);
    }

    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || '알 수 없는 오류' });
  }
};
