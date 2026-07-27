module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { password, name, badge, handle, bio, followers } = req.body || {};

    if (!password || password !== process.env.WRITE_PASSWORD) {
      res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
      return;
    }
    if (!name || !handle) {
      res.status(400).json({ error: '이름과 핸들은 필수입니다.' });
      return;
    }

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || 'main';
    const token = process.env.GITHUB_TOKEN;
    const filePath = 'profile.json';
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

    const getRes = await fetch(`${apiUrl}?ref=${branch}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json'
      }
    });
    if (!getRes.ok) {
      throw new Error('GitHub 파일 조회 실패 (' + getRes.status + ')');
    }
    const getData = await getRes.json();

    const updatedProfile = {
      name,
      badge: badge || '',
      handle,
      bio: bio || '',
      followers: Number(followers) || 0
    };

    const newContentBase64 = Buffer.from(
      JSON.stringify(updatedProfile, null, 2)
    ).toString('base64');

    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json'
      },
      body: JSON.stringify({
        message: '프로필 업데이트',
        content: newContentBase64,
        sha: getData.sha,
        branch
      })
    });

    if (!putRes.ok) {
      const errText = await putRes.text();
      throw new Error('GitHub 저장 실패: ' + errText);
    }

    res.status(200).json({
      success: true,
      message: '저장되었습니다. 30초~1분 후 사이트에 반영됩니다.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message || '알 수 없는 오류가 발생했습니다.' });
  }
};
