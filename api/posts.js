module.exports = async (req, res) => {
  if (req.method === 'DELETE') {
    return handleDelete(req, res);
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { password, category, content } = req.body || {};

    if (!password || password !== process.env.WRITE_PASSWORD) {
      res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
      return;
    }
    if (!category || !content || !content.trim()) {
      res.status(400).json({ error: '카테고리와 내용을 입력해주세요.' });
      return;
    }
    if (!['market', 'column', 'notice'].includes(category)) {
      res.status(400).json({ error: '올바르지 않은 카테고리입니다.' });
      return;
    }

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || 'main';
    const token = process.env.GITHUB_TOKEN;
    const filePath = 'posts.json';
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

    // 1) 현재 posts.json 읽기
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
    const currentPosts = JSON.parse(
      Buffer.from(getData.content, 'base64').toString('utf-8')
    );

    // 2) 새 글 추가
    const newPost = {
      id: Date.now(),
      category,
      content: content.trim(),
      date: new Date().toISOString(),
      views: 0
    };
    const updatedPosts = [newPost, ...currentPosts];

    const newContentBase64 = Buffer.from(
      JSON.stringify(updatedPosts, null, 2)
    ).toString('base64');

    // 3) GitHub에 커밋 (자동으로 Vercel 재배포 트리거됨)
    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json'
      },
      body: JSON.stringify({
        message: `새 글 추가 (${category})`,
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

async function handleDelete(req, res) {
  try {
    const { password, id } = req.body || {};

    if (!password || password !== process.env.WRITE_PASSWORD) {
      res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
      return;
    }
    if (!id) {
      res.status(400).json({ error: '삭제할 글 정보가 없습니다.' });
      return;
    }

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || 'main';
    const token = process.env.GITHUB_TOKEN;
    const filePath = 'posts.json';
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
    const currentPosts = JSON.parse(
      Buffer.from(getData.content, 'base64').toString('utf-8')
    );

    const updatedPosts = currentPosts.filter(p => String(p.id) !== String(id));

    if (updatedPosts.length === currentPosts.length) {
      res.status(404).json({ error: '해당 글을 찾을 수 없습니다.' });
      return;
    }

    const newContentBase64 = Buffer.from(
      JSON.stringify(updatedPosts, null, 2)
    ).toString('base64');

    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json'
      },
      body: JSON.stringify({
        message: `글 삭제 (id: ${id})`,
        content: newContentBase64,
        sha: getData.sha,
        branch
      })
    });

    if (!putRes.ok) {
      const errText = await putRes.text();
      throw new Error('GitHub 삭제 실패: ' + errText);
    }

    res.status(200).json({
      success: true,
      message: '삭제되었습니다. 30초~1분 후 사이트에 반영됩니다.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message || '알 수 없는 오류가 발생했습니다.' });
  }
}
